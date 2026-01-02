import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import SubtitleOverlay from './SubtitleOverlay';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

const VideoPlayer = forwardRef(({ src, onTimeUpdate, transcript, currentTime, videoId }, ref) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const canvasRef = useRef(null);

    // Basic controls
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [duration, setDuration] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMiniPlayer, setIsMiniPlayer] = useState(false);
    const [showControls, setShowControls] = useState(true);

    // Advanced controls
    const [showSettings, setShowSettings] = useState(false);
    const [loopStart, setLoopStart] = useState(null);
    const [loopEnd, setLoopEnd] = useState(null);
    const [isLooping, setIsLooping] = useState(false);

    // Video filters
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [saturation, setSaturation] = useState(100);
    const [hue, setHue] = useState(0);

    // Audio
    const [bassBoost, setBassBoost] = useState(0);
    const [audioTrack, setAudioTrack] = useState(0);
    const [audioTracks, setAudioTracks] = useState([]);

    // Subtitles
    const [subtitleOffset, setSubtitleOffset] = useState(0);
    const [externalSubtitles, setExternalSubtitles] = useState(null);
    // Thumbnails & Bookmarks
    const videoPreviewRef = useRef(null);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewTime, setPreviewTime] = useState(0);
    const [previewPos, setPreviewPos] = useState(0);
    const [bookmarks, setBookmarks] = useState([]);

    // Performance
    const [bufferedPercent, setBufferedPercent] = useState(0);
    const [codecInfo, setCodecInfo] = useState('');
    const [frameSkip, setFrameSkip] = useState(false);

    // Voice Control
    const [voiceEnabled, setVoiceEnabled] = useState(false);
    const [voiceStatus, setVoiceStatus] = useState('');
    const recognitionRef = useRef(null);

    // Setup Voice Control
    useEffect(() => {
        if (!voiceEnabled) {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            setVoiceStatus('');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setVoiceStatus('Voice not supported');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setVoiceStatus('Listening...');
        recognition.onerror = (e) => setVoiceStatus(`Error: ${e.error}`);
        recognition.onend = () => {
            if (voiceEnabled) recognition.start(); // Restart if still enabled
        };

        recognition.onresult = (event) => {
            const last = event.results.length - 1;
            const command = event.results[last][0].transcript.toLowerCase().trim();
            setVoiceStatus(`Heard: "${command}"`);

            // Process voice commands
            if (command.includes('play')) {
                videoRef.current?.play();
            } else if (command.includes('pause') || command.includes('stop')) {
                videoRef.current?.pause();
            } else if (command.includes('forward') || command.includes('skip ahead')) {
                skip(10);
            } else if (command.includes('back') || command.includes('rewind')) {
                skip(-10);
            } else if (command.includes('mute')) {
                setIsMuted(true);
            } else if (command.includes('unmute')) {
                setIsMuted(false);
            } else if (command.includes('fullscreen')) {
                toggleFullscreen();
            } else if (command.includes('volume up')) {
                setVolume(Math.min(1, volume + 0.2));
            } else if (command.includes('volume down')) {
                setVolume(Math.max(0, volume - 0.2));
            }
        };

        recognitionRef.current = recognition;
        recognition.start();

        return () => recognition.stop();
    }, [voiceEnabled]);

    // Load bookmarks
    useEffect(() => {
        if (videoId) {
            const saved = localStorage.getItem(`np_bookmarks_${videoId}`);
            if (saved) setBookmarks(JSON.parse(saved));
        }
    }, [videoId]);

    const addBookmark = () => {
        if (videoId) {
            const newBookmarks = [...bookmarks, progress].sort((a, b) => a - b);
            setBookmarks(newBookmarks);
            localStorage.setItem(`np_bookmarks_${videoId}`, JSON.stringify(newBookmarks));
        }
    };

    const handlePreviewHover = (e) => {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const percentage = x / width;
        const time = percentage * duration;

        setPreviewPos(x - 80); // Center the 160px preview
        setPreviewTime(time);
        setPreviewVisible(true);

        if (videoPreviewRef.current) {
            videoPreviewRef.current.currentTime = time;
        }
    };

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        seekTo: (time) => {
            if (videoRef.current) {
                videoRef.current.currentTime = time;
                videoRef.current.play();
            }
        }
    }));

    // Load saved position
    useEffect(() => {
        if (videoRef.current && src && videoId) {
            const savedPos = localStorage.getItem(`np_position_${videoId}`);
            if (savedPos) {
                const pos = parseFloat(savedPos);
                if (pos > 0 && pos < duration - 5) {
                    videoRef.current.currentTime = pos;
                }
            }
        }
    }, [src, videoId, duration]);

    // Save position periodically
    useEffect(() => {
        if (videoId && progress > 0) {
            localStorage.setItem(`np_position_${videoId}`, progress.toString());
        }
    }, [progress, videoId]);

    useEffect(() => {
        if (videoRef.current && src) {
            videoRef.current.load();
        }
    }, [src]);

    // A-B Loop check
    useEffect(() => {
        if (isLooping && loopEnd !== null && progress >= loopEnd) {
            if (videoRef.current && loopStart !== null) {
                videoRef.current.currentTime = loopStart;
            }
        }
    }, [progress, isLooping, loopStart, loopEnd]);

    // Get audio tracks
    useEffect(() => {
        if (videoRef.current) {
            const video = videoRef.current;
            if (video.audioTracks) {
                setAudioTracks(Array.from(video.audioTracks));
            }
        }
    }, [src]);

    // Annotations
    const [isAnnotating, setIsAnnotating] = useState(false);
    const [drawingColor, setDrawingColor] = useState('#ff0000');
    const [drawingSize, setDrawingSize] = useState(5);
    const [isDrawing, setIsDrawing] = useState(false);
    const lastPos = useRef({ x: 0, y: 0 });

    const startDrawing = (e) => {
        if (!isAnnotating || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        setIsDrawing(true);
        lastPos.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const draw = (e) => {
        if (!isDrawing || !isAnnotating || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.beginPath();
        ctx.strokeStyle = drawingColor;
        ctx.lineWidth = drawingSize;
        ctx.lineCap = 'round';
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();

        lastPos.current = { x, y };
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearAnnotations = () => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    };

    // Trim Video
    const handleTrim = async () => {
        if (loopStart !== null && loopEnd !== null && videoId) {
            try {
                const response = await fetch('http://127.0.0.1:8000/trim_video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        video_path: videoId,
                        start: loopStart,
                        end: loopEnd
                    })
                });

                const data = await response.json();

                if (data.status === 'success') {
                    alert(`Clip saved successfully!\nSaved to: ${data.output_path}`);
                } else {
                    alert(`Error saving clip: ${data.error}`);
                }
            } catch (error) {
                console.error('Trim error:', error);
                alert('Failed to connect to server for trimming.');
            }
        }
    };

    // Resize canvas on window resize
    useEffect(() => {
        const handleResize = () => {
            if (canvasRef.current && containerRef.current) {
                canvasRef.current.width = containerRef.current.clientWidth;
                canvasRef.current.height = containerRef.current.clientHeight;
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Apply video filters
    const getFilterStyle = () => {
        return {
            filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`
        };
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setProgress(videoRef.current.currentTime);
            if (onTimeUpdate) {
                onTimeUpdate(videoRef.current.currentTime);
            }
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const togglePlay = () => {
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play();
                setIsPlaying(true);
            } else {
                videoRef.current.pause();
                setIsPlaying(false);
            }
        }
    };

    const stop = () => {
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
            setIsPlaying(false);
        }
    };

    const skip = (seconds) => {
        if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
        }
    };

    const frameStep = (forward = true) => {
        if (videoRef.current) {
            videoRef.current.pause();
            setIsPlaying(false);
            videoRef.current.currentTime += forward ? (1 / 30) : -(1 / 30);
        }
    };

    const changeSpeed = () => {
        const currentIdx = SPEEDS.indexOf(speed);
        const nextIdx = (currentIdx + 1) % SPEEDS.length;
        const newSpeed = SPEEDS[nextIdx];
        setSpeed(newSpeed);
        if (videoRef.current) {
            videoRef.current.playbackRate = newSpeed;
        }
    };

    const handleVolumeChange = (e) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (videoRef.current) {
            videoRef.current.volume = val;
        }
        setIsMuted(val === 0);
    };

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handleSeek = (e) => {
        const val = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.currentTime = val;
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const toggleMiniPlayer = async () => {
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else if (videoRef.current && document.pictureInPictureEnabled) {
                await videoRef.current.requestPictureInPicture();
            } else {
                setIsMiniPlayer(!isMiniPlayer);
            }
        } catch (err) {
            console.error(err);
            setIsMiniPlayer(!isMiniPlayer);
        }
    };

    // A-B Loop
    const setLoopA = () => {
        setLoopStart(progress);
        if (loopEnd !== null && progress >= loopEnd) {
            setLoopEnd(null);
        }
    };

    const setLoopB = () => {
        if (loopStart !== null && progress > loopStart) {
            setLoopEnd(progress);
            setIsLooping(true);
        }
    };

    const clearLoop = () => {
        setLoopStart(null);
        setLoopEnd(null);
        setIsLooping(false);
    };

    // Screenshot
    const takeScreenshot = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0);

            const link = document.createElement('a');
            link.download = `screenshot_${Math.floor(progress)}s.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }
    };

    // Load external subtitles
    const loadSubtitles = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setExternalSubtitles(e.target.result);
            };
            reader.readAsText(file);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT') return;
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowLeft':
                    skip(-5);
                    break;
                case 'ArrowRight':
                    skip(5);
                    break;
                case 'ArrowUp':
                    setVolume(v => Math.min(1, v + 0.1));
                    break;
                case 'ArrowDown':
                    setVolume(v => Math.max(0, v - 0.1));
                    break;
                case 'f':
                    toggleFullscreen();
                    break;
                case 'm':
                    toggleMute();
                    break;
                case ',':
                    frameStep(false);
                    break;
                case '.':
                    frameStep(true);
                    break;
                case 's':
                    takeScreenshot();
                    break;
                case '[':
                    setLoopA();
                    break;
                case ']':
                    setLoopB();
                    break;
                case '\\':
                    clearLoop();
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [duration, progress, loopStart]);

    if (!src) {
        return (
            <div className="video-placeholder">
                <div style={{ textAlign: 'center', color: '#888' }}>
                    <h2>NeuralPlay</h2>
                    <p>Click "Open Video" to get started</p>
                    <p style={{ fontSize: '0.8em', marginTop: '20px' }}>
                        Shortcuts: Space=Play • ←→=Skip • ↑↓=Vol • F=Full • M=Mute<br />
                        S=Screenshot • [=Loop A • ]=Loop B • \=Clear Loop
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`video-container ${isMiniPlayer ? 'mini-player' : ''}`}
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(isPlaying ? false : true)}
        >
            <video
                ref={videoRef}
                width="100%"
                preload="auto"
                style={{ ...getFilterStyle(), maxHeight: isFullscreen ? '100vh' : '80vh' }}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={(e) => {
                    handleLoadedMetadata();
                    // Detect codec info
                    const video = e.target;
                    const videoTrack = video.videoTracks?.[0];
                    const audioTrack = video.audioTracks?.[0];
                    setCodecInfo(`Video: ${video.videoWidth}x${video.videoHeight} | Duration: ${Math.floor(video.duration)}s`);
                }}
                onProgress={(e) => {
                    const video = e.target;
                    if (video.buffered.length > 0 && video.duration > 0) {
                        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                        setBufferedPercent((bufferedEnd / video.duration) * 100);
                    }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                src={src}
                onClick={togglePlay}
                onDoubleClick={toggleFullscreen}
                // Touch Gestures
                onTouchStart={(e) => {
                    const touch = e.touches[0];
                    containerRef.current._touchStartX = touch.clientX;
                    containerRef.current._touchStartTime = Date.now();
                }}
                onTouchEnd={(e) => {
                    const touchEndX = e.changedTouches[0].clientX;
                    const deltaX = touchEndX - (containerRef.current._touchStartX || 0);
                    const elapsed = Date.now() - (containerRef.current._touchStartTime || 0);

                    // Tap = toggle pause (if tap was < 200ms and minimal movement)
                    if (elapsed < 200 && Math.abs(deltaX) < 30) {
                        togglePlay();
                    }
                    // Swipe right = forward 10s
                    else if (deltaX > 50) {
                        skip(10);
                    }
                    // Swipe left = rewind 10s
                    else if (deltaX < -50) {
                        skip(-10);
                    }
                }}
            />
            {/* Buffering Indicator */}
            {bufferedPercent < 100 && bufferedPercent > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    background: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    fontSize: '0.8em',
                    zIndex: 20
                }}>
                    Buffering: {Math.round(bufferedPercent)}%
                </div>
            )}
            <SubtitleOverlay
                transcript={transcript}
                currentTime={currentTime + subtitleOffset}
                externalSubtitles={externalSubtitles}
            />

            {/* Annotation Canvas */}
            <canvas
                ref={canvasRef}
                width={containerRef.current?.clientWidth}
                height={containerRef.current?.clientHeight}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    pointerEvents: isAnnotating ? 'all' : 'none',
                    zIndex: 15,
                    cursor: isAnnotating ? 'crosshair' : 'default'
                }}
            />

            {/* Voice Status Indicator */}
            {voiceStatus && (
                <div style={{
                    position: 'absolute',
                    top: '50px',
                    left: '10px',
                    background: 'rgba(100, 108, 255, 0.9)',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '0.9em',
                    zIndex: 25
                }}>
                    {voiceStatus}
                </div>
            )}

            {/* Loop Indicator */}
            {isLooping && (
                <div className="loop-indicator">
                    Loop: {formatTime(loopStart)} - {formatTime(loopEnd)}
                    <button onClick={handleTrim} style={{ marginLeft: '10px', fontSize: '0.8em', padding: '2px 5px' }}>
                        Save Clip
                    </button>
                </div>
            )}

            {/* Preview Video (Hidden unless hovering) */}
            <video
                ref={videoPreviewRef}
                src={src}
                muted
                style={{
                    display: previewVisible ? 'block' : 'none',
                    position: 'absolute',
                    bottom: '80px',
                    left: `${previewPos}px`,
                    width: '160px',
                    height: '90px',
                    objectFit: 'cover',
                    border: '2px solid #fff',
                    borderRadius: '4px',
                    backgroundColor: 'black',
                    zIndex: 20,
                    pointerEvents: 'none'
                }}
            />
            {previewVisible && (
                <div style={{
                    position: 'absolute',
                    bottom: '60px',
                    left: `${previewPos}px`,
                    width: '160px',
                    textAlign: 'center',
                    color: '#fff',
                    textShadow: '0 0 2px black',
                    fontSize: '0.8em',
                    zIndex: 21
                }}>
                    {formatTime(previewTime)}
                </div>
            )}

            {/* Annotation Toolbar */}
            {isAnnotating && (
                <div className="annotation-toolbar" style={{
                    position: 'absolute',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.8)',
                    padding: '10px',
                    borderRadius: '8px',
                    display: 'flex',
                    gap: '10px',
                    zIndex: 30
                }}>
                    <input type="color" value={drawingColor} onChange={e => setDrawingColor(e.target.value)} />
                    <input type="range" min="1" max="20" value={drawingSize} onChange={e => setDrawingSize(parseInt(e.target.value))} />
                    <button onClick={clearAnnotations}>Clear</button>
                    <button onClick={() => setIsAnnotating(false)}>Done</button>
                </div>
            )}

            {/* Custom Controls */}
            <div className={`video-controls ${showControls ? 'visible' : ''}`}>
                {/* Progress Bar */}
                <div className="progress-container">
                    <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        value={progress}
                        onChange={handleSeek}
                        onMouseMove={handlePreviewHover}
                        onMouseLeave={() => setPreviewVisible(false)}
                        className="progress-bar"
                        style={{
                            background: loopStart !== null && loopEnd !== null
                                ? `linear-gradient(to right, #444 ${loopStart / duration * 100}%, #646cff ${loopStart / duration * 100}%, #646cff ${loopEnd / duration * 100}%, #444 ${loopEnd / duration * 100}%)`
                                : undefined
                        }}
                    />
                    <span className="time-display">
                        {formatTime(progress)} / {formatTime(duration)}
                    </span>
                </div>

                {/* Control Buttons */}
                <div className="control-buttons">
                    <div className="left-controls">
                        <button onClick={togglePlay} title="Play/Pause (Space)">
                            {isPlaying ? '||' : '▷'}
                        </button>
                        <button onClick={stop} title="Stop">◼</button>
                        <button onClick={() => skip(-10)} title="Rewind 10s">«</button>
                        <button onClick={() => skip(10)} title="Forward 10s">»</button>
                        <button onClick={changeSpeed} title="Change Speed" className="speed-btn">
                            {speed}x
                        </button>
                        <button onClick={setLoopA} title="Set Loop Start ([)" className={loopStart !== null ? 'active' : ''}>
                            A
                        </button>
                        <button onClick={setLoopB} title="Set Loop End (])" className={loopEnd !== null ? 'active' : ''}>
                            B
                        </button>
                        {isLooping && <button onClick={clearLoop} title="Clear Loop">✕</button>}
                    </div>

                    <div className="right-controls">
                        <button
                            onClick={() => setVoiceEnabled(!voiceEnabled)}
                            title={voiceEnabled ? 'Disable Voice Control' : 'Enable Voice Control'}
                            style={{ color: voiceEnabled ? '#646cff' : 'white' }}
                        >
                            MIC
                        </button>
                        <button onClick={() => setIsAnnotating(!isAnnotating)} title="Annotate" style={{ color: isAnnotating ? '#646cff' : 'white' }}>
                            DRAW
                        </button>
                        <button onClick={takeScreenshot} title="Screenshot (S)">CAP</button>
                        <button onClick={toggleMute} title="Mute (M)">
                            {isMuted ? 'MUTED' : 'VOL'}
                        </button>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={volume}
                            onChange={handleVolumeChange}
                            className="volume-slider"
                            title="Volume"
                        />
                        <button onClick={() => setShowSettings(!showSettings)} title="Settings">SET</button>
                        <button onClick={toggleMiniPlayer} title="Mini Player">
                            {isMiniPlayer ? 'EXIT' : 'PIP'}
                        </button>
                        <button onClick={toggleFullscreen} title="Fullscreen (F)">[ ]</button>
                    </div>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="settings-panel">
                    <h4>Utility Tools</h4>
                    <div className="filter-row">
                        <button onClick={() => { setIsAnnotating(true); setShowSettings(false); }}>
                            Start Annotating
                        </button>
                    </div>
                    {isLooping && (
                        <div className="filter-row">
                            <button onClick={handleTrim}>
                                Trim Selected Loop
                            </button>
                        </div>
                    )}
                    <hr style={{ margin: '10px 0', borderColor: '#444' }} />

                    <h4>Video Filters</h4>
                    <div className="filter-row">
                        <label>Brightness: {brightness}%</label>
                        <input type="range" min="50" max="150" value={brightness} onChange={e => setBrightness(e.target.value)} />
                    </div>
                    <div className="filter-row">
                        <label>Contrast: {contrast}%</label>
                        <input type="range" min="50" max="150" value={contrast} onChange={e => setContrast(e.target.value)} />
                    </div>
                    <div className="filter-row">
                        <label>Saturation: {saturation}%</label>
                        <input type="range" min="0" max="200" value={saturation} onChange={e => setSaturation(e.target.value)} />
                    </div>
                    <div className="filter-row">
                        <label>Hue: {hue}°</label>
                        <input type="range" min="-180" max="180" value={hue} onChange={e => setHue(e.target.value)} />
                    </div>
                    <button onClick={() => { setBrightness(100); setContrast(100); setSaturation(100); setHue(0); }}>
                        Reset Filters
                    </button>

                    <h4>Subtitles</h4>
                    <div className="filter-row">
                        <label>Subtitle Offset: {subtitleOffset}s</label>
                        <input type="range" min="-10" max="10" step="0.1" value={subtitleOffset} onChange={e => setSubtitleOffset(parseFloat(e.target.value))} />
                    </div>
                    <input type="file" accept=".srt,.vtt,.sub" onChange={loadSubtitles} />

                    <button onClick={() => setShowSettings(false)}>Close</button>
                </div>
            )}
        </div>
    );
});

export default VideoPlayer;
