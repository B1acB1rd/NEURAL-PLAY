from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "NeuralPlay Backend Running"}

from database import init_db
@app.on_event("startup")
def on_startup():
    init_db()

from transcription import transcribe_video
from database import SessionLocal, Video, Transcript
from pydantic import BaseModel

class TranscribeRequest(BaseModel):
    video_path: str

@app.post("/transcribe")
def api_transcribe(video_path: str):
    return transcribe_video(video_path)

@app.post("/store_transcript")
async def store_transcript(video_path: str, data: dict):
    session = SessionLocal()
    video = session.query(Video).filter(Video.path == video_path).first()
    if not video:
        video = Video(path=video_path, name=os.path.basename(video_path))
        session.add(video)
        session.commit()
        session.refresh(video)
    
    session.query(Transcript).filter(Transcript.video_id == video.id).delete()
    
    for seg in data.get('segments', []):
        t = Transcript(video_id=video.id, text=seg['text'], start_time=seg['start'], end_time=seg['end'])
        session.add(t)
    
    session.commit()
    session.close()
    return {"status": "ok"}

# Search endpoint
@app.get("/search_transcript")
def search_transcript(query: str):
    session = SessionLocal()
    results = session.query(Transcript).filter(Transcript.text.contains(query)).all()
    output = [{"start": t.start_time, "end": t.end_time, "text": t.text} for t in results]
    session.close()
    return output

# ---------- STREAMING ENDPOINTS ----------

from scene_detection import detect_scenes, detect_scenes_streaming
from object_detection import detect_objects, detect_objects_streaming
from emotion_recognition import detect_emotions, detect_emotions_streaming

# SSE Streaming endpoint for all analysis at once
@app.get("/analyze_stream")
def analyze_stream(video_path: str):
    def generate():
        # Run scene detection
        for data in detect_scenes_streaming(video_path, 0.85):
            yield f"data: {data}\n\n"
        
        # Run object detection
        for data in detect_objects_streaming(video_path, 2.0):
            yield f"data: {data}\n\n"
        
        # Run emotion detection
        for data in detect_emotions_streaming(video_path, 3.0):
            yield f"data: {data}\n\n"
        
        yield f"data: {{\"type\": \"complete\", \"message\": \"All analysis complete\"}}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

# Non-streaming endpoints (kept for backwards compatibility)
@app.post("/detect_scenes")
def api_detect_scenes(video_path: str):
    return detect_scenes(video_path)

@app.post("/detect_objects")
def api_detect_objects(video_path: str):
    return detect_objects(video_path)

@app.post("/detect_emotions")
def api_detect_emotions(video_path: str):
    return detect_emotions(video_path)

# Summarization
from summarization import summarize_scene
@app.post("/summarize_scene")
def api_summarize_scene(text: str):
    return {"summary": summarize_scene(text)}

# Q&A System
from qa_system import ask_question
@app.post("/ask_question")
def api_ask_question(query: str, video_path: str):
    session = SessionLocal()
    video = session.query(Video).filter(Video.path == video_path).first()
    transcript_data = None
    if video:
        db_segments = session.query(Transcript).filter(Transcript.video_id == video.id).all()
        if db_segments:
            segments = [{"start": s.start_time, "end": s.end_time, "text": s.text} for s in db_segments]
            full_text = " ".join([s.text for s in db_segments])
            transcript_data = {"text": full_text, "segments": segments}
    session.close()
    return {"answer": ask_question(query, transcript_data)}

# Video Trimming
class TrimRequest(BaseModel):
    video_path: str
    start: float
    end: float

import subprocess
import time

@app.post("/trim_video")
def trim_video(req: TrimRequest):
    if not os.path.exists(req.video_path):
        return {"error": "Video file not found"}
        
    # Generate output path
    dir_name = os.path.dirname(req.video_path)
    base_name = os.path.splitext(os.path.basename(req.video_path))[0]
    timestamp = int(time.time())
    output_path = os.path.join(dir_name, f"{base_name}_clip_{timestamp}.mp4")
    
    # FFmpeg command: fast stream copy
    # -ss before -i for faster seeking
    cmd = [
        'ffmpeg', '-y',
        '-ss', str(req.start),
        '-to', str(req.end),
        '-i', req.video_path,
        '-c', 'copy',
        output_path
    ]
    
    # Hide console window on Windows
    startupinfo = None
    if os.name == 'nt':
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

    try:
        subprocess.run(cmd, check=True, capture_output=True, startupinfo=startupinfo)
        return {"status": "success", "output_path": output_path, "message": f"Clip saved to {output_path}"}
    except subprocess.CalledProcessError as e:
        return {"error": f"FFmpeg failed: {e.stderr.decode() if e.stderr else str(e)}"}
    except Exception as e:
        return {"error": f"Trimming failed: {str(e)}"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
