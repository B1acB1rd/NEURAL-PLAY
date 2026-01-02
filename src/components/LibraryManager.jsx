import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');

// Library stored in localStorage
const STORAGE_KEY = 'np_library';
const HISTORY_KEY = 'np_history';
const FAVORITES_KEY = 'np_favorites';
const WATCH_LATER_KEY = 'np_watch_later';
const PLAYLISTS_KEY = 'np_playlists';

function LibraryManager({ onVideoSelect, currentVideo }) {
    const [activeTab, setActiveTab] = useState('library');
    const [library, setLibrary] = useState([]);
    const [history, setHistory] = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [watchLater, setWatchLater] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [currentPlaylist, setCurrentPlaylist] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isShuffled, setIsShuffled] = useState(false);
    const [repeatMode, setRepeatMode] = useState('none'); // none, one, all
    const [sortBy, setSortBy] = useState('name');
    const [filterText, setFilterText] = useState('');
    const [newPlaylistName, setNewPlaylistName] = useState('');

    // Load data from localStorage
    useEffect(() => {
        setLibrary(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
        setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'));
        setFavorites(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'));
        setWatchLater(JSON.parse(localStorage.getItem(WATCH_LATER_KEY) || '[]'));
        setPlaylists(JSON.parse(localStorage.getItem(PLAYLISTS_KEY) || '[]'));
    }, []);

    // Save data
    const saveLibrary = (data) => { setLibrary(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); };
    const saveHistory = (data) => { setHistory(data); localStorage.setItem(HISTORY_KEY, JSON.stringify(data)); };
    const saveFavorites = (data) => { setFavorites(data); localStorage.setItem(FAVORITES_KEY, JSON.stringify(data)); };
    const saveWatchLater = (data) => { setWatchLater(data); localStorage.setItem(WATCH_LATER_KEY, JSON.stringify(data)); };
    const savePlaylists = (data) => { setPlaylists(data); localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(data)); };

    // Add to history when video plays
    useEffect(() => {
        if (currentVideo) {
            const videoInfo = {
                path: currentVideo,
                name: currentVideo.split(/[/\\]/).pop(),
                playedAt: new Date().toISOString()
            };
            const newHistory = [videoInfo, ...history.filter(v => v.path !== currentVideo)].slice(0, 50);
            saveHistory(newHistory);

            // Add to library if not exists
            if (!library.find(v => v.path === currentVideo)) {
                saveLibrary([...library, { ...videoInfo, addedAt: new Date().toISOString() }]);
            }
        }
    }, [currentVideo]);

    // Scan folder
    const scanFolder = async () => {
        const result = await ipcRenderer.invoke('scan-folder');
        if (result && result.length > 0) {
            const newVideos = result.map(path => ({
                path,
                name: path.split(/[/\\]/).pop(),
                addedAt: new Date().toISOString()
            })).filter(v => !library.find(l => l.path === v.path));
            saveLibrary([...library, ...newVideos]);
        }
    };

    // Playlist controls
    const createPlaylist = () => {
        if (newPlaylistName.trim()) {
            const newPlaylist = { id: Date.now(), name: newPlaylistName, videos: [] };
            savePlaylists([...playlists, newPlaylist]);
            setNewPlaylistName('');
        }
    };

    const addToPlaylist = (playlistId, video) => {
        const updated = playlists.map(p => {
            if (p.id === playlistId && !p.videos.find(v => v.path === video.path)) {
                return { ...p, videos: [...p.videos, video] };
            }
            return p;
        });
        savePlaylists(updated);
    };

    const playPlaylist = (playlist, startIndex = 0) => {
        setCurrentPlaylist(playlist);
        setCurrentIndex(startIndex);
        if (playlist.videos[startIndex]) {
            onVideoSelect(playlist.videos[startIndex].path);
        }
    };

    const playNext = () => {
        if (!currentPlaylist) return;
        let nextIndex = currentIndex + 1;
        if (isShuffled) {
            nextIndex = Math.floor(Math.random() * currentPlaylist.videos.length);
        }
        if (nextIndex >= currentPlaylist.videos.length) {
            if (repeatMode === 'all') nextIndex = 0;
            else return;
        }
        setCurrentIndex(nextIndex);
        onVideoSelect(currentPlaylist.videos[nextIndex].path);
    };

    const playPrevious = () => {
        if (!currentPlaylist) return;
        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) {
            if (repeatMode === 'all') prevIndex = currentPlaylist.videos.length - 1;
            else return;
        }
        setCurrentIndex(prevIndex);
        onVideoSelect(currentPlaylist.videos[prevIndex].path);
    };

    // Toggle functions
    const toggleFavorite = (video) => {
        if (favorites.find(v => v.path === video.path)) {
            saveFavorites(favorites.filter(v => v.path !== video.path));
        } else {
            saveFavorites([...favorites, video]);
        }
    };

    const toggleWatchLater = (video) => {
        if (watchLater.find(v => v.path === video.path)) {
            saveWatchLater(watchLater.filter(v => v.path !== video.path));
        } else {
            saveWatchLater([...watchLater, video]);
        }
    };

    const removeFromLibrary = (path) => {
        saveLibrary(library.filter(v => v.path !== path));
    };

    // Sorting
    const sortVideos = (videos) => {
        return [...videos].sort((a, b) => {
            switch (sortBy) {
                case 'name': return a.name.localeCompare(b.name);
                case 'date': return new Date(b.addedAt || 0) - new Date(a.addedAt || 0);
                default: return 0;
            }
        });
    };

    // Filtering
    const filterVideos = (videos) => {
        if (!filterText) return videos;
        return videos.filter(v => v.name.toLowerCase().includes(filterText.toLowerCase()));
    };

    const getDisplayVideos = () => {
        switch (activeTab) {
            case 'library': return filterVideos(sortVideos(library));
            case 'history': return history;
            case 'favorites': return favorites;
            case 'watchLater': return watchLater;
            default: return [];
        }
    };

    return (
        <div className="library-manager">
            {/* Tabs */}
            <div className="lib-tabs">
                <button className={activeTab === 'library' ? 'active' : ''} onClick={() => setActiveTab('library')}>Library</button>
                <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>History</button>
                <button className={activeTab === 'favorites' ? 'active' : ''} onClick={() => setActiveTab('favorites')}>Favorites</button>
                <button className={activeTab === 'watchLater' ? 'active' : ''} onClick={() => setActiveTab('watchLater')}>Watch Later</button>
                <button className={activeTab === 'playlists' ? 'active' : ''} onClick={() => setActiveTab('playlists')}>Playlists</button>
            </div>

            {/* Toolbar */}
            {activeTab === 'library' && (
                <div className="lib-toolbar">
                    <button onClick={scanFolder}>Scan Folder</button>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                        <option value="name">Sort: Name</option>
                        <option value="date">Sort: Date Added</option>
                    </select>
                    <input
                        type="text"
                        placeholder="Filter..."
                        value={filterText}
                        onChange={e => setFilterText(e.target.value)}
                    />
                </div>
            )}

            {/* Playlist Controls */}
            {currentPlaylist && (
                <div className="playlist-controls">
                    <span>Now Playing: {currentPlaylist.name}</span>
                    <button onClick={playPrevious}>Prev</button>
                    <button onClick={playNext}>Next</button>
                    <button onClick={() => setIsShuffled(!isShuffled)} className={isShuffled ? 'active' : ''}>Shuffle</button>
                    <button onClick={() => setRepeatMode(repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none')}>
                        {repeatMode === 'none' ? 'No Repeat' : repeatMode === 'all' ? 'Repeat All' : 'Repeat One'}
                    </button>
                </div>
            )}

            {/* Playlists Tab */}
            {activeTab === 'playlists' && (
                <div className="playlists-section">
                    <div className="create-playlist">
                        <input
                            type="text"
                            placeholder="New playlist name..."
                            value={newPlaylistName}
                            onChange={e => setNewPlaylistName(e.target.value)}
                        />
                        <button onClick={createPlaylist}>+ Create</button>
                    </div>
                    {playlists.map(playlist => (
                        <div key={playlist.id} className="playlist-item">
                            <div className="playlist-header" onClick={() => playPlaylist(playlist)}>
                                <span>{playlist.name}</span>
                                <span className="video-count">{playlist.videos.length} videos</span>
                            </div>
                            <div className="playlist-videos">
                                {playlist.videos.map((video, idx) => (
                                    <div key={idx} className="video-item" onClick={() => playPlaylist(playlist, idx)}>
                                        {video.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Video List */}
            {activeTab !== 'playlists' && (
                <div className="video-list">
                    {getDisplayVideos().map((video, idx) => (
                        <div
                            key={idx}
                            className={`video-item ${currentVideo === video.path ? 'playing' : ''}`}
                        >
                            <div className="video-info" onClick={() => onVideoSelect(video.path)}>
                                <span className="video-name">{video.name}</span>
                                {video.playedAt && <small>{new Date(video.playedAt).toLocaleDateString()}</small>}
                            </div>
                            <div className="video-actions">
                                <button onClick={() => toggleFavorite(video)} title="Favorite">
                                    {favorites.find(f => f.path === video.path) ? '★' : '☆'}
                                </button>
                                <button onClick={() => toggleWatchLater(video)} title="Watch Later">
                                    {watchLater.find(w => w.path === video.path) ? '●' : '○'}
                                </button>
                                {playlists.length > 0 && (
                                    <select onChange={e => e.target.value && addToPlaylist(parseInt(e.target.value), video)}>
                                        <option value="">+ Playlist</option>
                                        {playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                )}
                                {activeTab === 'library' && (
                                    <button onClick={() => removeFromLibrary(video.path)} title="Remove">×</button>
                                )}
                            </div>
                        </div>
                    ))}
                    {getDisplayVideos().length === 0 && (
                        <div className="empty-list">
                            {activeTab === 'library' && 'Click "Scan Folder" to add videos'}
                            {activeTab === 'history' && 'No videos played yet'}
                            {activeTab === 'favorites' && 'No favorites yet'}
                            {activeTab === 'watchLater' && 'No videos in watch later'}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default LibraryManager;
