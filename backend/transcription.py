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
            _model = whisper.load_model("base")
            print("[Transcription] Whisper model loaded successfully")
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
