from collections import Counter
import re

def summarize_text(text, max_words=20):
    if not text:
        return ""
    
    words = re.findall(r'\w+', text.lower())
    common = Counter(words).most_common(10)
    
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'was', 'it', 'this', 'that', 'i', 'you', 'we', 'they', 'he', 'she'}
    keywords = [w for w, c in common if w not in stop_words and len(w) > 2]
    
    summary = "Key topics: " + ", ".join(keywords[:5]) if keywords else "No key topics found."
    return summary

def summarize_scene(scene_text):
    return summarize_text(scene_text)
