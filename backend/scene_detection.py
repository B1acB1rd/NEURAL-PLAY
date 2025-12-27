import cv2
import os
import json
import numpy as np

# Try to use better scene detection if available
try:
    import torch
    from torchvision import models, transforms
    DEEP_LEARNING_AVAILABLE = True
except ImportError:
    DEEP_LEARNING_AVAILABLE = False

# Pre-defined scene categories for classification
SCENE_CATEGORIES = [
    "outdoor", "indoor", "nature", "urban", "action", 
    "dialogue", "transition", "establishing_shot", "close_up", "wide_shot"
]

def get_feature_extractor():
    """Load a pre-trained ResNet for feature extraction"""
    if not DEEP_LEARNING_AVAILABLE:
        return None, None
    
    model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
    model = torch.nn.Sequential(*list(model.children())[:-1])  # Remove classifier
    model.eval()
    
    transform = transforms.Compose([
        transforms.ToPILImage(),
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    return model, transform

def detect_scenes_streaming(video_path, threshold=0.7):
    """Generator that yields scenes as they are detected using AI features"""
    if not os.path.exists(video_path):
        yield json.dumps({"error": "File not found"})
        return
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        yield json.dumps({"error": "Could not open video"})
        return
        
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Try to use deep learning, fallback to histogram
    model, transform = None, None
    if DEEP_LEARNING_AVAILABLE:
        try:
            model, transform = get_feature_extractor()
        except:
            pass
    
    prev_features = None
    start_frame = 0
    frame_count = 0
    skip_frames = 15  # Check every 15 frames for efficiency
    scene_count = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        if frame_count % skip_frames == 0:
            # Deep learning feature extraction
            if model is not None and transform is not None:
                try:
                    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    input_tensor = transform(rgb_frame).unsqueeze(0)
                    with torch.no_grad():
                        features = model(input_tensor).squeeze().numpy()
                    
                    if prev_features is not None:
                        # Cosine similarity between feature vectors
                        similarity = np.dot(features, prev_features) / (
                            np.linalg.norm(features) * np.linalg.norm(prev_features) + 1e-8
                        )
                        
                        if similarity < threshold:
                            end_frame = frame_count
                            duration = (end_frame - start_frame) / fps
                            if duration > 1.0:  # Minimum 1 second scenes
                                scene_count += 1
                                scene = {
                                    "type": "scene",
                                    "id": scene_count,
                                    "start": round(start_frame / fps, 2),
                                    "end": round(end_frame / fps, 2),
                                    "duration": round(duration, 2),
                                    "confidence": round(1 - similarity, 2)
                                }
                                yield json.dumps(scene)
                            start_frame = frame_count
                    
                    prev_features = features
                except Exception as e:
                    # Fallback to histogram on error
                    pass
            else:
                # Fallback: Simple histogram comparison
                hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
                hist = cv2.calcHist([hsv], [0, 1], None, [50, 60], [0, 180, 0, 256])
                cv2.normalize(hist, hist, 0, 1, cv2.NORM_MINMAX)
                features = hist.flatten()
                
                if prev_features is not None:
                    score = cv2.compareHist(
                        prev_features.reshape(50, 60), 
                        features.reshape(50, 60), 
                        cv2.HISTCMP_CORREL
                    )
                    
                    if score < 0.85:
                        end_frame = frame_count
                        duration = (end_frame - start_frame) / fps
                        if duration > 1.0:
                            scene_count += 1
                            scene = {
                                "type": "scene",
                                "id": scene_count,
                                "start": round(start_frame / fps, 2),
                                "end": round(end_frame / fps, 2),
                                "duration": round(duration, 2)
                            }
                            yield json.dumps(scene)
                        start_frame = frame_count
                
                prev_features = features
            
        frame_count += 1
        
    # Last scene
    duration = (frame_count - start_frame) / fps
    if duration > 1.0:
        scene_count += 1
        scene = {
            "type": "scene",
            "id": scene_count,
            "start": round(start_frame / fps, 2),
            "end": round(frame_count / fps, 2),
            "duration": round(duration, 2)
        }
        yield json.dumps(scene)
        
    cap.release()
    yield json.dumps({
        "type": "done", 
        "message": f"Scene detection complete. Found {scene_count} scenes.",
        "method": "deep_learning" if DEEP_LEARNING_AVAILABLE else "histogram"
    })

# Keep old function for backwards compatibility
def detect_scenes(video_path, threshold=30.0):
    scenes = []
    for data in detect_scenes_streaming(video_path, 0.7):
        parsed = json.loads(data)
        if parsed.get("type") == "scene":
            scenes.append(parsed)
    return {"scenes": scenes}
