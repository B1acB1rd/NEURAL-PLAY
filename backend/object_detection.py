import cv2
import os
import json

# Lazy loading - model loads on first use, not at import
_model = None

def get_model():
    global _model
    if _model is None:
        try:
            from ultralytics import YOLO
            _model = YOLO('yolov8n.pt')
            print("[ObjectDetection] YOLO model loaded successfully")
        except ImportError:
            print("[ObjectDetection] YOLO not installed")
            return None
        except Exception as e:
            print(f"[ObjectDetection] Error loading YOLO: {e}")
            return None
    return _model

def detect_objects_streaming(video_path, interval_seconds=2.0):
    """Generator that yields objects as they are detected"""
    model = get_model()
    
    if model is None:
        yield json.dumps({"error": "YOLO not installed. Run: pip install ultralytics"})
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
            results = model(frame, verbose=False)
            
            frame_objects = []
            for result in results:
                for box in result.boxes:
                    cls_id = int(box.cls[0])
                    label = model.names[cls_id]
                    conf = float(box.conf[0])
                    if conf > 0.5:
                        frame_objects.append(label)
            
            unique_objects = list(set(frame_objects))
            if unique_objects:
                detection = {
                    "type": "object",
                    "time": current_time,
                    "objects": unique_objects
                }
                yield json.dumps(detection)
        
        frame_count += 1
        
    cap.release()
    yield json.dumps({"type": "done", "message": "Object detection complete"})

def detect_objects(video_path, interval_seconds=2.0):
    detections = []
    for data in detect_objects_streaming(video_path, interval_seconds):
        parsed = json.loads(data)
        if parsed.get("type") == "object":
            detections.append({"time": parsed["time"], "objects": parsed["objects"]})
    return {"detections": detections}
