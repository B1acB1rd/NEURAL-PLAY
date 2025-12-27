from datetime import timedelta

def ask_question(query, transcript_data):
    if not transcript_data:
        return "No transcript available. Please transcribe the video first."

    query = query.lower()
    text_content = transcript_data.get('text', '').lower()
    segments = transcript_data.get('segments', [])
    
    # Summary question
    if 'about' in query or 'summar' in query:
        return f"This video discusses: {text_content[:200]}..."

    # When question
    if 'when' in query:
        keywords = [w for w in query.split() if w not in ['when', 'does', 'happen', 'the', 'video', 'in', 'show', 'say', 'is', 'it']]
        found = []
        for kw in keywords:
            for seg in segments:
                if kw in seg['text'].lower():
                    found.append(seg)
        
        if found:
            times = sorted(list(set([s['start'] for s in found])))[:3]
            time_strs = [str(timedelta(seconds=int(t))) for t in times]
            return f"Found mentions around: {', '.join(time_strs)}."
            
    # General check
    for seg in segments:
        if any(word in seg['text'].lower() for word in query.split() if len(word) > 3):
            return f"Found at {int(seg['start'])}s: \"{seg['text']}\""

    return "I couldn't find specific information about that in the video."
