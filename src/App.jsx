import { useState, useRef, useEffect } from 'react'
import './App.css'
import VideoPlayer from './components/VideoPlayer'
import TranscriptView from './components/TranscriptView'
import LibraryManager from './components/LibraryManager'
const { ipcRenderer } = window.require('electron');

function App() {
    const videoRef = useRef(null);
    const [videoPath, setVideoPath] = useState(null);
    const [realPath, setRealPath] = useState(null);
    const [transcript, setTranscript] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [analysisStatus, setAnalysisStatus] = useState("");
    const [showLibrary, setShowLibrary] = useState(false);
    const [sidebarVisible, setSidebarVisible] = useState(false); // Hidden by default for clean video experience

    // Theme & Accessibility
    const [theme, setTheme] = useState(localStorage.getItem('np_theme') || 'dark');
    const [fontScale, setFontScale] = useState(parseFloat(localStorage.getItem('np_fontScale') || '1'));
    const [showAppSettings, setShowAppSettings] = useState(false);

    // Recent Files
    const [recentFiles, setRecentFiles] = useState(() => JSON.parse(localStorage.getItem('np_recent') || '[]'));

    // Onboarding
    const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('np_onboarded'));
    const [onboardingStep, setOnboardingStep] = useState(0);

    // Drag & Drop state
    const [isDragging, setIsDragging] = useState(false);

    // Handle drag & drop
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) {
            const filePath = file.path;
            setVideoPath(`file://${filePath}`);
            setRealPath(filePath);
            addToRecent(filePath);
        }
    };

    // Add to recent files
    const addToRecent = (path) => {
        const updated = [path, ...recentFiles.filter(p => p !== path)].slice(0, 10);
        setRecentFiles(updated);
        localStorage.setItem('np_recent', JSON.stringify(updated));
    };

    // Apply theme
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('np_theme', theme);
    }, [theme]);

    // Apply font scale
    useEffect(() => {
        document.documentElement.style.setProperty('--font-scale', fontScale);
        localStorage.setItem('np_fontScale', fontScale.toString());
    }, [fontScale]);

    // Search
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);

    // Real-time results
    const [scenes, setScenes] = useState([]);
    const [objects, setObjects] = useState([]);
    const [emotions, setEmotions] = useState([]);

    // Q&A
    const [chatQuery, setChatQuery] = useState("");
    const [chatAnswer, setChatAnswer] = useState("");
    const [isAsking, setIsAsking] = useState(false);

    // Feature Toggles (AI features opt-in)
    const [enableTranscription, setEnableTranscription] = useState(true);
    const [enableScenes, setEnableScenes] = useState(true);
    const [enableObjects, setEnableObjects] = useState(false);
    const [enableEmotions, setEnableEmotions] = useState(false);

    // IPC Listeners for Menu actions
    useEffect(() => {
        const handleOpenVideo = () => handleOpenVideo();
        const handleToggleLibrary = () => setShowLibrary(prev => !prev);
        const handleToggleSettings = () => setShowAppSettings(prev => !prev);
        const handleExportTranscript = () => {
            if (transcript && transcript.segments) {
                const text = transcript.segments.map(s => `[${Math.floor(s.start)}s] ${s.text}`).join('\n');
                const blob = new Blob([text], { type: 'text/plain' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'transcript.txt';
                link.click();
            }
        };

        ipcRenderer.on('menu-open-video', handleOpenVideo);
        ipcRenderer.on('menu-toggle-library', handleToggleLibrary);
        ipcRenderer.on('menu-toggle-settings', handleToggleSettings);
        ipcRenderer.on('menu-export-transcript', handleExportTranscript);

        return () => {
            ipcRenderer.removeListener('menu-open-video', handleOpenVideo);
            ipcRenderer.removeListener('menu-toggle-library', handleToggleLibrary);
            ipcRenderer.removeListener('menu-toggle-settings', handleToggleSettings);
            ipcRenderer.removeListener('menu-export-transcript', handleExportTranscript);
        };
    }, [transcript]);

    // Seek video to time
    const seekTo = (time) => {
        if (videoRef.current) {
            videoRef.current.seekTo(time);
        }
    };

    // Format time helper
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleOpenVideo = async () => {
        const filePath = await ipcRenderer.invoke('open-video');
        if (filePath) {
            setVideoPath(`file://${filePath}`);
            setRealPath(filePath);
            setTranscript(null);
            setScenes([]);
            setObjects([]);
            setEmotions([]);
            setChatAnswer("");
        }
    };

    // Only run analysis when video opens AND user has enabled features
    useEffect(() => {
        if (realPath && (enableScenes || enableObjects || enableEmotions)) {
            runStreamingAnalysis();
        }
        // Transcription is now MANUAL only - user must click the button
    }, [realPath]);

    const runStreamingAnalysis = async () => {
        if (!realPath) return;

        setAnalysisStatus("Starting analysis...");
        setScenes([]);
        setObjects([]);
        setEmotions([]);

        try {
            const eventSource = new EventSource(
                `http://localhost:8000/analyze_stream?video_path=${encodeURIComponent(realPath)}`
            );

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    switch (data.type) {
                        case 'scene':
                            if (enableScenes) {
                                setScenes(prev => [...prev, data]);
                                setAnalysisStatus("Detecting scenes...");
                            }
                            break;
                        case 'object':
                            if (enableObjects) {
                                setObjects(prev => [...prev, data]);
                                setAnalysisStatus("Detecting objects...");
                            }
                            break;
                        case 'emotion':
                            if (enableEmotions) {
                                setEmotions(prev => [...prev, data]);
                                setAnalysisStatus("Detecting emotions...");
                            }
                            break;
                        case 'done':
                            // One phase complete
                            break;
                        case 'complete':
                            setAnalysisStatus("Analysis complete!");
                            setTimeout(() => setAnalysisStatus(""), 2000);
                            eventSource.close();
                            break;
                        case 'error':
                            console.error("Analysis error:", data.error);
                            break;
                    }
                } catch (e) {
                    console.error("Parse error:", e);
                }
            };

            eventSource.onerror = () => {
                setAnalysisStatus("Connection lost");
                eventSource.close();
            };

        } catch (error) {
            console.error("Streaming failed:", error);
            setAnalysisStatus("Analysis failed");
        }
    };

    const handleTranscribe = async () => {
        if (!realPath) return;
        setIsTranscribing(true);
        try {
            const response = await fetch('http://localhost:8000/transcribe?video_path=' + encodeURIComponent(realPath), { method: 'POST' });
            const data = await response.json();
            if (data.error) {
                alert("Transcription failed: " + data.error);
            } else {
                await fetch('http://localhost:8000/store_transcript?video_path=' + encodeURIComponent(realPath), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                setTranscript(data);
            }
        } catch (error) {
            alert("Error connecting to backend.");
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery) return;
        try {
            const response = await fetch(`http://localhost:8000/search_transcript?query=${encodeURIComponent(searchQuery)}`);
            setSearchResults(await response.json());
        } catch (error) {
            console.error("Search failed:", error);
        }
    };

    const handleAskQuestion = async (e) => {
        e.preventDefault();
        if (!realPath || !chatQuery) return;
        setIsAsking(true);
        try {
            const response = await fetch(`http://localhost:8000/ask_question?query=${encodeURIComponent(chatQuery)}&video_path=${encodeURIComponent(realPath)}`, { method: 'POST' });
            const data = await response.json();
            setChatAnswer(data.answer);
        } catch (error) {
            setChatAnswer("Error getting answer.");
        } finally {
            setIsAsking(false);
        }
    };

    const handleLibrarySelect = (path) => {
        setVideoPath(`file://${path}`);
        setRealPath(path);
        setTranscript(null);
        setScenes([]);
        setObjects([]);
        setEmotions([]);
        setChatAnswer("");
    };

    // Group objects by type
    const groupedObjects = {};
    objects.forEach(obj => {
        obj.objects.forEach(name => {
            if (!groupedObjects[name]) groupedObjects[name] = [];
            groupedObjects[name].push(obj.time);
        });
    });

    // Group emotions by type
    const groupedEmotions = {};
    emotions.forEach(emo => {
        emo.emotions.forEach(emotion => {
            if (!groupedEmotions[emotion]) groupedEmotions[emotion] = [];
            groupedEmotions[emotion].push(emo.time);
        });
    });

    return (
        <div
            className="container"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag Overlay */}
            {isDragging && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(100, 108, 255, 0.3)',
                    border: '4px dashed var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2em',
                    color: 'white',
                    zIndex: 9999
                }}>
                    Drop video file here
                </div>
            )}

            {/* Onboarding Tutorial */}
            {showOnboarding && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.85)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                    color: 'white',
                    textAlign: 'center',
                    padding: '20px'
                }}>
                    {onboardingStep === 0 && (
                        <>
                            <h1>Welcome to NeuralPlay!</h1>
                            <p style={{ fontSize: '1.2em', maxWidth: '500px' }}>
                                AI-powered video player with transcription, scene detection,
                                object recognition, and more.
                            </p>
                        </>
                    )}
                    {onboardingStep === 1 && (
                        <>
                            <h2>Keyboard Shortcuts</h2>
                            <div style={{ textAlign: 'left', fontSize: '1.1em' }}>
                                <p>Space - Play/Pause</p>
                                <p>← / → - Seek 5s</p>
                                <p>↑ / ↓ - Volume</p>
                                <p>F - Fullscreen</p>
                                <p>M - Mute</p>
                                <p>S - Screenshot</p>
                            </div>
                        </>
                    )}
                    {onboardingStep === 2 && (
                        <>
                            <h2>Voice Control</h2>
                            <p>Click the microphone button to enable voice commands:</p>
                            <p style={{ fontStyle: 'italic' }}>"Play", "Pause", "Skip", "Mute", "Fullscreen"</p>
                        </>
                    )}
                    <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
                        {onboardingStep < 2 ? (
                            <button onClick={() => setOnboardingStep(s => s + 1)} style={{ padding: '10px 30px', fontSize: '1.1em' }}>
                                Next →
                            </button>
                        ) : (
                            <button onClick={() => {
                                setShowOnboarding(false);
                                localStorage.setItem('np_onboarded', 'true');
                            }} style={{ padding: '10px 30px', fontSize: '1.1em', background: 'var(--accent)' }}>
                                Get Started!
                            </button>
                        )}
                        <button onClick={() => {
                            setShowOnboarding(false);
                            localStorage.setItem('np_onboarded', 'true');
                        }} style={{ padding: '10px 20px', opacity: 0.7 }}>
                            Skip
                        </button>
                    </div>
                </div>
            )}

            {/* Sidebar Toggle Button */}
            <button
                className="sidebar-toggle"
                onClick={() => setSidebarVisible(prev => !prev)}
                style={{
                    position: 'fixed',
                    left: sidebarVisible ? '290px' : '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 1000,
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: sidebarVisible ? '0 4px 4px 0' : '4px',
                    padding: '10px 5px',
                    cursor: 'pointer',
                    transition: 'left 0.3s ease',
                    color: 'white',
                    fontSize: '1.2em',
                    width: 'auto'
                }}
                title={sidebarVisible ? 'Hide Panel' : 'Show Panel'}
            >
                {sidebarVisible ? '‹' : '›'}
            </button>

            {/* Collapsible Sidebar */}
            <div className={`sidebar ${!sidebarVisible ? 'collapsed' : ''}`} style={{
                width: sidebarVisible ? '300px' : '0',
                minWidth: sidebarVisible ? '300px' : '0',
                padding: sidebarVisible ? '20px' : '0',
                overflow: sidebarVisible ? 'auto' : 'hidden',
                transition: 'all 0.3s ease'
            }}>
                {sidebarVisible && (
                    <>
                        <h1>NeuralPlay</h1>
                        <div className="view-toggle">
                            <button className={!showLibrary ? 'active' : ''} onClick={() => setShowLibrary(false)}>Analysis</button>
                            <button className={showLibrary ? 'active' : ''} onClick={() => setShowLibrary(true)}>Library</button>
                        </div>

                        {showLibrary ? (
                            <LibraryManager onVideoSelect={handleLibrarySelect} currentVideo={realPath} />
                        ) : (
                            <>
                                <button onClick={handleOpenVideo}>Open Video</button>
                                <button onClick={handleTranscribe} disabled={!realPath || isTranscribing}>
                                    {isTranscribing ? 'Transcribing...' : 'Transcribe'}
                                </button>

                                {/* Recent Files */}
                                {recentFiles.length > 0 && (
                                    <details style={{ marginTop: '10px' }}>
                                        <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>Recent Files ({recentFiles.length})</summary>
                                        <div style={{ marginTop: '5px', maxHeight: '150px', overflow: 'auto' }}>
                                            {recentFiles.map((path, i) => (
                                                <div
                                                    key={i}
                                                    onClick={() => {
                                                        setVideoPath(`file://${path}`);
                                                        setRealPath(path);
                                                    }}
                                                    style={{
                                                        padding: '5px 8px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.85em',
                                                        borderRadius: '4px',
                                                        marginBottom: '2px',
                                                        background: path === realPath ? 'var(--accent)' : 'transparent'
                                                    }}
                                                >
                                                    {path.split(/[/\\]/).pop()}
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                )}

                                {analysisStatus && <div className="analyzing">{analysisStatus}</div>}

                                <hr />

                                {/* Search */}
                                <div className="search-box">
                                    <form onSubmit={handleSearch}>
                                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search transcripts..." />
                                        <button type="submit">Search</button>
                                    </form>
                                </div>

                                {/* Search Results */}
                                {searchResults.length > 0 && (
                                    <div className="results-list">
                                        <h4>Search Results</h4>
                                        {searchResults.map((res, idx) => (
                                            <div key={idx} className="result-item" onClick={() => seekTo(res.start)}>
                                                <small>{Math.floor(res.start)}s</small> - {res.text.substring(0, 30)}...
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Chapters (Auto-generated from Scenes) */}
                                {scenes.length > 0 && (
                                    <div className="results-list">
                                        <h4>Chapters ({scenes.length})</h4>
                                        {scenes.slice(0, 15).map((scene, idx) => (
                                            <div key={idx} className="result-item chapter-item" onClick={() => seekTo(scene.start)}>
                                                <div><strong>Chapter {idx + 1}</strong></div>
                                                <small>{formatTime(scene.start)} - {formatTime(scene.start + (scene.duration || 0))} ({scene.duration?.toFixed(1)}s)</small>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Smart Skip */}
                                {scenes.length > 2 && (
                                    <div className="smart-skip" style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                                        <button
                                            onClick={() => seekTo(scenes[1]?.start || 30)}
                                            style={{ flex: 1, background: 'var(--bg-tertiary)' }}
                                            title="Skip intro (jump to second scene)"
                                        >
                                            Skip Intro
                                        </button>
                                        <button
                                            onClick={() => seekTo(scenes[scenes.length - 2]?.start || 0)}
                                            style={{ flex: 1, background: 'var(--bg-tertiary)' }}
                                            title="Skip to credits (jump to second-to-last scene)"
                                        >
                                            Near End
                                        </button>
                                    </div>
                                )}

                                {/* Objects - Collapsible */}
                                {Object.keys(groupedObjects).length > 0 && (
                                    <details>
                                        <summary>Objects ({objects.length} detections)</summary>
                                        <div className="results-list scrollable-section">
                                            {Object.entries(groupedObjects).slice(0, 8).map(([name, times]) => (
                                                <div key={name} className="category-group">
                                                    <div className="category-label">{name} ({times.length})</div>
                                                    <div className="time-chips">
                                                        {times.slice(0, 4).map((t, i) => (
                                                            <span key={i} className="time-chip" onClick={() => seekTo(t)}>
                                                                {Math.floor(t)}s
                                                            </span>
                                                        ))}
                                                        {times.length > 4 && <span className="more">+{times.length - 4}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                )}

                                {/* Emotions - Collapsible */}
                                {Object.keys(groupedEmotions).length > 0 && (
                                    <details>
                                        <summary>Emotions ({emotions.length} detections)</summary>
                                        <div className="results-list scrollable-section">
                                            {Object.entries(groupedEmotions).map(([emotion, times]) => (
                                                <div key={emotion} className="category-group">
                                                    <div className="category-label">{emotion} ({times.length})</div>
                                                    <div className="time-chips">
                                                        {times.slice(0, 4).map((t, i) => (
                                                            <span key={i} className="time-chip" onClick={() => seekTo(t)}>
                                                                {Math.floor(t)}s
                                                            </span>
                                                        ))}
                                                        {times.length > 4 && <span className="more">+{times.length - 4}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                )}

                                <hr />

                                {/* Q&A */}
                                <div className="chat-box">
                                    <h4>Ask the Video</h4>
                                    <form onSubmit={handleAskQuestion}>
                                        <input type="text" value={chatQuery} onChange={(e) => setChatQuery(e.target.value)} placeholder="What is this video about?" />
                                        <button type="submit" disabled={isAsking}>Ask</button>
                                    </form>
                                    {chatAnswer && <div className="chat-answer"><strong>Answer:</strong> {chatAnswer}</div>}
                                </div>

                                {/* AI Summary & Highlight Reel */}
                                <div style={{ marginTop: '10px', display: 'flex', gap: '5px' }}>
                                    <button
                                        onClick={async () => {
                                            if (!transcript) { alert('Please transcribe first'); return; }
                                            setChatQuery("Give me a brief summary of this video in 3-4 sentences");
                                            setIsAsking(true);
                                            try {
                                                const resp = await fetch(`http://127.0.0.1:8000/ask_question?query=Summarize&video_path=${encodeURIComponent(realPath)}`, { method: 'POST' });
                                                const data = await resp.json();
                                                setChatAnswer(data.answer || 'Unable to generate summary');
                                            } catch (e) { setChatAnswer('Error generating summary'); }
                                            setIsAsking(false);
                                        }}
                                        style={{ flex: 1, background: 'var(--bg-tertiary)' }}
                                        disabled={isAsking}
                                    >
                                        AI Summary
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (scenes.length < 3) { alert('Analyze video first to detect scenes'); return; }
                                            // Extract highlight moments (longest scenes)
                                            const sorted = [...scenes].sort((a, b) => (b.duration || 0) - (a.duration || 0));
                                            const highlights = sorted.slice(0, 5);
                                            const msg = highlights.map((h, i) => `${i + 1}. ${formatTime(h.start)} (${h.duration?.toFixed(1)}s)`).join('\n');
                                            alert(`Top 5 Highlights:\n${msg}`);
                                        }}
                                        style={{ flex: 1, background: 'var(--bg-tertiary)' }}
                                    >
                                        Highlights
                                    </button>
                                </div>

                                <hr />
                                <TranscriptView transcript={transcript} currentTime={currentTime} onSeek={seekTo} />

                                {/* App Settings Button */}
                                <button onClick={() => setShowAppSettings(!showAppSettings)} style={{ marginTop: '10px', background: 'var(--bg-tertiary)' }}>
                                    App Settings
                                </button>

                                {/* App Settings Modal */}
                                {showAppSettings && (
                                    <div className="app-settings-panel" style={{ background: 'var(--bg-tertiary)', padding: '15px', borderRadius: '8px', marginTop: '10px' }}>
                                        <h4 style={{ marginTop: 0 }}>AI Features (Opt-in)</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={enableScenes} onChange={(e) => setEnableScenes(e.target.checked)} />
                                                Scene Detection (Chapters)
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={enableObjects} onChange={(e) => setEnableObjects(e.target.checked)} />
                                                Object Detection
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={enableEmotions} onChange={(e) => setEnableEmotions(e.target.checked)} />
                                                Emotion Detection
                                            </label>
                                        </div>

                                        <h4>Theme</h4>
                                        <select value={theme} onChange={(e) => setTheme(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '15px' }}>
                                            <option value="dark">Dark</option>
                                            <option value="light">Light</option>
                                            <option value="high-contrast">High Contrast</option>
                                        </select>

                                        <h4>UI Scale ({Math.round(fontScale * 100)}%)</h4>
                                        <input
                                            type="range"
                                            min="0.8"
                                            max="1.5"
                                            step="0.1"
                                            value={fontScale}
                                            onChange={(e) => setFontScale(parseFloat(e.target.value))}
                                            style={{ width: '100%', marginBottom: '15px' }}
                                        />

                                        <h4>Transcript Export</h4>
                                        <button onClick={() => {
                                            if (transcript && transcript.segments) {
                                                const text = transcript.segments.map(s => `[${Math.floor(s.start)}s] ${s.text}`).join('\n');
                                                const blob = new Blob([text], { type: 'text/plain' });
                                                const link = document.createElement('a');
                                                link.href = URL.createObjectURL(blob);
                                                link.download = 'transcript.txt';
                                                link.click();
                                            } else {
                                                alert('No transcript available');
                                            }
                                        }}>Export TXT</button>

                                        <button onClick={() => {
                                            if (transcript && transcript.segments) {
                                                const srt = transcript.segments.map((s, i) => {
                                                    const formatSrt = (sec) => {
                                                        const h = Math.floor(sec / 3600).toString().padStart(2, '0');
                                                        const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
                                                        const sInt = Math.floor(sec % 60).toString().padStart(2, '0');
                                                        const ms = Math.floor((sec % 1) * 1000).toString().padStart(3, '0');
                                                        return `${h}:${m}:${sInt},${ms}`;
                                                    };
                                                    return `${i + 1}\n${formatSrt(s.start)} --> ${formatSrt(s.end)}\n${s.text}`;
                                                }).join('\n\n');
                                                const blob = new Blob([srt], { type: 'text/srt' });
                                                const link = document.createElement('a');
                                                link.href = URL.createObjectURL(blob);
                                                link.download = 'transcript.srt';
                                                link.click();
                                            } else {
                                                alert('No transcript available');
                                            }
                                        }}>Export SRT</button>

                                        <hr />
                                        <h4>Support the Project</h4>
                                        <p style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                                            Made by <strong>Oredipe Oluwagbohunmi Adekunle</strong><br />
                                            aka <strong>B1ACB1RD</strong>
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75em' }}>
                                            <div
                                                onClick={async () => {
                                                    const addr = '79gVfZ4q8UcFojF7S23afiVZ8APy2YbfsyLofqD92UzB';
                                                    try { await navigator.clipboard.writeText(addr); }
                                                    catch { const t = document.createElement('textarea'); t.value = addr; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); }
                                                    alert('SOL address copied!');
                                                }}
                                                style={{ cursor: 'pointer', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '4px' }}
                                            >
                                                <strong>SOL:</strong> 79gVfZ4...2UzB <span style={{ opacity: 0.6 }}>(tap to copy)</span>
                                            </div>
                                            <div
                                                onClick={async () => {
                                                    const addr = '0x75DFFB62b779BFc5706864cE7d4Cd259b0372c0B';
                                                    try { await navigator.clipboard.writeText(addr); }
                                                    catch { const t = document.createElement('textarea'); t.value = addr; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); }
                                                    alert('ETH address copied!');
                                                }}
                                                style={{ cursor: 'pointer', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '4px' }}
                                            >
                                                <strong>ETH:</strong> 0x75DFF...2c0B <span style={{ opacity: 0.6 }}>(tap to copy)</span>
                                            </div>
                                            <div
                                                onClick={async () => {
                                                    const addr = 'bc1qfljhc88vsdxdddm4ggaq4e89qthzv2n4a7sajv';
                                                    try { await navigator.clipboard.writeText(addr); }
                                                    catch { const t = document.createElement('textarea'); t.value = addr; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); }
                                                    alert('BTC address copied!');
                                                }}
                                                style={{ cursor: 'pointer', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '4px' }}
                                            >
                                                <strong>BTC:</strong> bc1qflj...sajv <span style={{ opacity: 0.6 }}>(tap to copy)</span>
                                            </div>
                                        </div>

                                        <button onClick={() => setShowAppSettings(false)} style={{ marginTop: '15px' }}>Close</button>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
            <div className="main-content">
                <VideoPlayer ref={videoRef} src={videoPath} onTimeUpdate={setCurrentTime} transcript={transcript} currentTime={currentTime} videoId={realPath} />
            </div>
        </div>
    );
}

export default App;
