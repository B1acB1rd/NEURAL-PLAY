import cv2
import os
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lazy loading - DeepFace loads on first use
_deepface = None

def get_deepface():
    global _deepface
    if _deepface is None:
        try:
            from deepface import DeepFace
            _deepface = DeepFace
            print("[EmotionRecognition] DeepFace loaded successfully")
        except ImportError:
            print("[EmotionRecognition] DeepFace not installed")
            return None
        except Exception as e:
            print(f"[EmotionRecognition] Error loading DeepFace: {e}")
            return None
    return _deepface

def detect_emotions_streaming(video_path, interval_seconds=3.0):
    """Generator that yields emotions as they are detected"""
    DeepFace = get_deepface()
    
    if DeepFace is None:
        yield json.dumps({"error": "DeepFace not installed. Run: pip install deepface tf-keras"})
        return
    
    if not os.path.exists(video_path):
        yield json.dumps({"error": "File not found"})
        return

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        yield json.dumps({"error": "Could not open video"})
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_interval = int(fps * interval_seconds)
    frame_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        if frame_count % frame_interval == 0:
            current_time = frame_count / fps
            try:
                predictions = DeepFace.analyze(frame, actions=['emotion'], enforce_detection=False, silent=True)
                frame_emotions = [pred['dominant_emotion'] for pred in predictions]
                if frame_emotions:
                    emotion_data = {
                        "type": "emotion",
                        "time": current_time,
                        "emotions": frame_emotions
                    }
                    yield json.dumps(emotion_data)
            except Exception as e:
                logger.error(f"Error at {current_time}: {e}")
        
        frame_count += 1
        
    cap.release()
    yield json.dumps({"type": "done", "message": "Emotion detection complete"})

def detect_emotions(video_path, interval_seconds=3.0):
    emotions_list = []
    for data in detect_emotions_streaming(video_path, interval_seconds):
        parsed = json.loads(data)
        if parsed.get("type") == "emotion":
            emotions_list.append({"time": parsed["time"], "emotions": parsed["emotions"]})
    return {"emotions": emotions_list}
