import React, { useEffect, useRef } from 'react';

function TranscriptView({ transcript, currentTime, onSeek }) {
    const listRef = useRef(null);

    useEffect(() => {
        if (!transcript) return;
        // Auto-scroll logic could go here
    }, [currentTime, transcript]);

    if (!transcript) {
        return (
            <div className="transcript-container">
                <div className="placeholder">Transcripts will appear here...</div>
            </div>
        );
    }

    return (
        <div className="transcript-container">
            <h3>Interactive Transcript</h3>
            <p style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginTop: 0 }}>Click any line to jump</p>
            <div className="transcript-list" ref={listRef}>
                {transcript.segments.map((seg, idx) => {
                    const isActive = currentTime >= seg.start && currentTime < seg.end;
                    return (
                        <div
                            key={idx}
                            className={`transcript-segment ${isActive ? 'active' : ''}`}
                            ref={isActive ? (el) => el?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : null}
                            onClick={() => onSeek && onSeek(seg.start)}
                            style={{ cursor: 'pointer' }}
                        >
                            <span className="timestamp">{Math.floor(seg.start)}s</span>
                            <span className="text">{seg.text}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default TranscriptView;
