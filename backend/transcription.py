import os
import subprocess

# Try to find ffmpeg and add to PATH
def setup_ffmpeg():
    # Check if ffmpeg is already available
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        return True
    except:
        pass
    
    # Try to find ffmpeg-static in node_modules
    node_ffmpeg = os.path.join(os.path.dirname(__file__), '..', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')
    if os.path.exists(node_ffmpeg):
        ffmpeg_dir = os.path.dirname(os.path.abspath(node_ffmpeg))
        os.environ['PATH'] = ffmpeg_dir + os.pathsep + os.environ.get('PATH', '')
        return True
    
    # Check common Windows install locations
    common_paths = [
        r"C:\ffmpeg\bin",
        r"C:\Program Files\ffmpeg\bin",
        os.path.expanduser(r"~\AppData\Local\Microsoft\WinGet\Links"),
    ]
    for path in common_paths:
        if os.path.exists(os.path.join(path, 'ffmpeg.exe')):
            os.environ['PATH'] = path + os.pathsep + os.environ.get('PATH', '')
            return True
    
    return False

# Lazy loading for Whisper
_model = None

def get_whisper_model():
    global _model
    if _model is None:
        # Setup ffmpeg first
        if not setup_ffmpeg():
            print("[Transcription] Warning: FFmpeg not found. Transcription may fail.")
        
        try:
            import whisper
            _model = whisper.load_model("tiny")  # Use tiny for speed (4x faster than base)
            print("[Transcription] Whisper 'tiny' model loaded (optimized for speed)")
        except ImportError:
            print("[Transcription] Whisper not installed")
            return None
        except Exception as e:
            print(f"[Transcription] Error loading Whisper: {e}")
            return None
    return _model

def transcribe_video(video_path):
    model = get_whisper_model()
    
    if model is None:
        return {"error": "Whisper not installed. Run: pip install openai-whisper"}
    
    if not os.path.exists(video_path):
        return {"error": "File not found"}
    
    # Extract audio to temporary file to avoid piping issues
    import tempfile
    import shutil
    
    temp_audio = os.path.join(tempfile.gettempdir(), f"temp_audio_{os.getpid()}.wav")
    
    try:
        # Check ffmpeg availability again
        if not setup_ffmpeg():
            return {"error": "FFmpeg not found. Please install FFmpeg."}
            
        # Extract audio using ffmpeg directly
        # -y: overwrite, -vn: no video, -acodec pcm_s16le: wav format, -ar 16000: 16k sample rate (whisper expects this)
        cmd = [
            'ffmpeg', '-y', 
            '-i', video_path, 
            '-vn', 
            '-acodec', 'pcm_s16le', 
            '-ar', '16000', 
            '-ac', '1', 
            temp_audio
        ]
        
        # specific for windows to hide console window
        startupinfo = None
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            
        subprocess.run(cmd, check=True, capture_output=True, startupinfo=startupinfo)
        
        if not os.path.exists(temp_audio):
           return {"error": "Failed to extract audio from video"}

        # Transcribe the temp audio file
        result = model.transcribe(temp_audio)
        
        segments = []
        for seg in result.get("segments", []):
            segments.append({
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"].strip()
            })
        
        return {
            "text": result.get("text", ""),
            "segments": segments
        }
        
    except subprocess.CalledProcessError as e:
        return {"error": f"FFmpeg failed: {e.stderr.decode() if e.stderr else str(e)}"}
    except Exception as e:
        return {"error": f"Transcription failed: {str(e)}"}
    finally:
        # Cleanup
        if os.path.exists(temp_audio):
            try:
                os.remove(temp_audio)
            except:
                pass


def get_video_duration(video_path):
    """Get video duration in seconds using ffprobe"""
    try:
        startupinfo = None
        if os.name == 'nt':
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        
        cmd = [
            'ffprobe', '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            video_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, startupinfo=startupinfo)
        return float(result.stdout.strip())
    except:
        return None


def transcribe_video_streaming(video_path, chunk_duration=20):
    """
    Streaming transcription that yields segments progressively.
    
    Instead of transcribing the entire video at once, this function:
    1. Splits audio into chunks (default 20 seconds each for fast response)
    2. Transcribes each chunk immediately  
    3. Yields segments as they're ready
    
    This allows subtitles to appear within ~10-15 seconds (like YouTube)
    instead of waiting for the entire video to be transcribed.
    
    Yields:
        dict: Either a segment {"type": "segment", "data": {...}} 
              or status {"type": "progress", "percent": N, "message": "..."}
              or error {"type": "error", "error": "..."}
              or completion {"type": "complete"}
    """
    import tempfile
    import json
    
    model = get_whisper_model()
    
    if model is None:
        yield json.dumps({"type": "error", "error": "Whisper not installed. Run: pip install openai-whisper"})
        return
    
    if not os.path.exists(video_path):
        yield json.dumps({"type": "error", "error": "File not found"})
        return
    
    if not setup_ffmpeg():
        yield json.dumps({"type": "error", "error": "FFmpeg not found. Please install FFmpeg."})
        return
    
    # Get total duration
    total_duration = get_video_duration(video_path)
    if not total_duration:
        # Fallback: try normal transcription
        yield json.dumps({"type": "progress", "percent": 0, "message": "Could not determine duration, using full transcription..."})
        result = transcribe_video(video_path)
        if "error" in result:
            yield json.dumps({"type": "error", "error": result["error"]})
        else:
            for seg in result.get("segments", []):
                yield json.dumps({"type": "segment", "data": seg})
            yield json.dumps({"type": "complete"})
        return
    
    yield json.dumps({"type": "progress", "percent": 0, "message": f"Starting transcription ({int(total_duration)}s video)..."})
    
    # Process in chunks
    temp_dir = tempfile.gettempdir()
    current_time = 0
    all_segments = []
    
    startupinfo = None
    if os.name == 'nt':
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    
    try:
        while current_time < total_duration:
            chunk_end = min(current_time + chunk_duration, total_duration)
            chunk_file = os.path.join(temp_dir, f"chunk_{os.getpid()}_{int(current_time)}.wav")
            
            # Extract audio chunk
            cmd = [
                'ffmpeg', '-y',
                '-ss', str(current_time),
                '-t', str(chunk_duration),
                '-i', video_path,
                '-vn',
                '-acodec', 'pcm_s16le',
                '-ar', '16000',
                '-ac', '1',
                chunk_file
            ]
            
            try:
                subprocess.run(cmd, check=True, capture_output=True, startupinfo=startupinfo)
            except subprocess.CalledProcessError as e:
                yield json.dumps({"type": "error", "error": f"FFmpeg chunk extraction failed: {str(e)}"})
                return
            
            if not os.path.exists(chunk_file):
                yield json.dumps({"type": "error", "error": f"Failed to extract chunk at {current_time}s"})
                return
            
            # Transcribe this chunk
            try:
                result = model.transcribe(chunk_file)
                
                # Adjust timestamps by adding current_time offset
                for seg in result.get("segments", []):
                    adjusted_segment = {
                        "start": seg["start"] + current_time,
                        "end": seg["end"] + current_time,
                        "text": seg["text"].strip()
                    }
                    all_segments.append(adjusted_segment)
                    # Yield each segment immediately for real-time subtitles
                    yield json.dumps({"type": "segment", "data": adjusted_segment})
                
            except Exception as e:
                yield json.dumps({"type": "error", "error": f"Transcription failed at {current_time}s: {str(e)}"})
                return
            finally:
                # Cleanup chunk file
                if os.path.exists(chunk_file):
                    try:
                        os.remove(chunk_file)
                    except:
                        pass
            
            # Update progress
            percent = int((chunk_end / total_duration) * 100)
            yield json.dumps({"type": "progress", "percent": percent, "message": f"Transcribed {int(chunk_end)}s / {int(total_duration)}s"})
            
            current_time = chunk_end
        
        # All done
        yield json.dumps({"type": "complete", "total_segments": len(all_segments)})
        
    except Exception as e:
        yield json.dumps({"type": "error", "error": f"Streaming transcription failed: {str(e)}"})
