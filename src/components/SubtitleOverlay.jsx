import React, { useMemo } from 'react';

function SubtitleOverlay({ transcript, currentTime, externalSubtitles, offset = 0, style }) {
    // Parse SRT/VTT content
    const parsedExternal = useMemo(() => {
        if (!externalSubtitles) return null;

        const segments = [];
        const lines = externalSubtitles.trim().replace(/\r\n/g, '\n').split('\n\n');

        lines.forEach(block => {
            const parts = block.split('\n');
            if (parts.length >= 2) {
                // Handle index line if present
                let timeLine = parts[0].includes('-->') ? parts[0] : parts[1];
                let textLines = parts[0].includes('-->') ? parts.slice(1) : parts.slice(2);

                if (timeLine && timeLine.includes('-->')) {
                    const [startStr, endStr] = timeLine.split('-->');
                    const parseTime = (t) => {
                        const [h, m, s] = t.trim().split(':');
                        const [sec, ms] = s.split(/[,.]/);
                        return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(sec) + parseInt(ms || 0) / 1000;
                    };

                    try {
                        segments.push({
                            start: parseTime(startStr),
                            end: parseTime(endStr),
                            text: textLines.join('\n')
                        });
                    } catch (e) { }
                }
            }
        });
        return segments;
    }, [externalSubtitles]);

    const activeSegments = (parsedExternal || (transcript && transcript.segments));
    const effectiveTime = currentTime + (offset || 0);

    if (!activeSegments) return null;

    const currentSegment = activeSegments.find(
        seg => effectiveTime >= seg.start && effectiveTime < seg.end
    );

    if (!currentSegment) return null;

    // Default styles
    const defaultStyle = {
        fontSize: '1.5em',
        color: 'white',
        textShadow: '2px 2px 2px black, 0 0 5px black',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: '5px 10px',
        borderRadius: '5px',
        textAlign: 'center',
        whiteSpace: 'pre-wrap',
        position: 'absolute',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '80%',
        zIndex: 10
    };

    return (
        <div style={{ ...defaultStyle, ...style }}>
            {currentSegment.text}
        </div>
    );
}

export default SubtitleOverlay;
