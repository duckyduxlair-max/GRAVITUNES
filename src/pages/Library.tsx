import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, ListMusic, ListPlus, MoreVertical, Trash2, Search, PlusCircle, DownloadCloud } from 'lucide-react';
import { useLibraryStore } from '../store/libraryStore';
import { usePlayerStore } from '../store/playerStore';
import { useUIStore } from '../store/uiStore';
import { deleteAudioBlob } from '../services/db';
import PageTransition from '../components/layout/PageTransition';
import AddToPlaylistModal from '../components/common/AddToPlaylistModal';

const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')} `;
};

const Library: React.FC = () => {
    const navigate = useNavigate();
    const { songs, removeSong } = useLibraryStore();
    const { currentSongId, isPlaying, playSong, setIsPlaying, queue, setQueue } = usePlayerStore();
    const { globalSearch, setGlobalSearch } = useUIStore();

    const [sortOption, setSortOption] = useState<'date' | 'title' | 'duration'>('date');
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [playlistModalSongId, setPlaylistModalSongId] = useState<string | null>(null);

    const songList = Object.values(songs);

    const filteredSongs = songList
        .filter(song => song.title.toLowerCase().includes(globalSearch.toLowerCase()))
        .sort((a, b) => {
            if (sortOption === 'date') return b.dateAdded - a.dateAdded;
            if (sortOption === 'title') return a.title.localeCompare(b.title);
            if (sortOption === 'duration') return b.duration - a.duration;
            return 0;
        });

    const handlePlay = (songId: string) => {
        if (currentSongId === songId) {
            setIsPlaying(!isPlaying);
        } else {
            playSong(songId, filteredSongs.map(s => s.id));
        }
    };

    const handleDelete = async (songId: string) => {
        await deleteAudioBlob(songId);
        removeSong(songId);
    };

    return (
        <PageTransition>
            <div className="w-full h-full flex flex-col pb-10 max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
                    <div>
                        <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white/5 font-['Outfit'] leading-none select-none">
                            LIBRARY
                        </h2>
                        <h3 className="text-lg font-bold tracking-wide text-white -mt-5 md:-mt-6 ml-1 font-['Outfit']">
                            Your <span className="text-accent">Songs</span>
                            <span className="text-zinc-600 text-sm ml-2">({songList.length})</span>
                        </h3>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                            <input
                                type="text"
                                value={globalSearch}
                                onChange={(e) => setGlobalSearch(e.target.value)}
                                placeholder="Search library..."
                                className="bg-white/3 border border-white/5 rounded-xl py-2.5 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-accent/30 transition-colors w-full md:w-56"
                            />
                        </div>

                        {/* Sort */}
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as any)}
                            className="bg-white/3 border border-white/5 rounded-xl py-2.5 px-3 text-sm text-zinc-400 focus:outline-none appearance-none cursor-pointer"
                        >
                            <option value="date" className="bg-zinc-900">Recent</option>
                            <option value="title" className="bg-zinc-900">A-Z</option>
                            <option value="duration" className="bg-zinc-900">Duration</option>
                        </select>
                    </div>
                </div>

                {songList.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center mt-[-10vh]">
                        <div className="text-center">
                            <div className="w-24 h-24 mx-auto rounded-full glass-panel flex items-center justify-center mb-5">
                                <span className="text-3xl text-accent/50 select-none">♫</span>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2 tracking-wide font-['Outfit']">No Songs Yet</h3>
                            <p className="text-zinc-500 text-sm max-w-sm mx-auto mb-4">
                                Your library is empty. Import some tracks to get started.
                            </p>
                            <button
                                onClick={() => navigate('/import')}
                                className="px-6 py-2.5 rounded-xl bg-accent text-black font-bold text-sm tracking-wider hover:bg-accent/80 transition-all flex items-center gap-2 mx-auto"
                            >
                                <ListPlus size={16} /> Import Music
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto pr-1 space-y-1">
                        {/* Song Rows */}
                        {filteredSongs.map((song) => {
                            const isActive = currentSongId === song.id;
                            const thumb = song.thumbnail || `https://picsum.photos/seed/${song.id}/100/100`;

                            return (
                                <div
                                    key={song.id}
                                    onDoubleClick={() => {
                                        if (currentSongId !== song.id) playSong(song.id, filteredSongs.map(s => s.id));
                                        navigate('/now-playing');
                                    }}
                                    className={`flex items-center gap-3 p-2.5 rounded-2xl transition-all group cursor-default
                                        ${isActive
                                            ? 'bg-accent/5 border border-accent/15'
                                            : 'border border-transparent hover:bg-white/3'
                                        }`}
                                >
                                    {/* Thumbnail + Play */}
                                    <div
                                        className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-zinc-800 cursor-pointer"
                                        onClick={() => handlePlay(song.id)}
                                    >
                                        <img src={thumb} alt={song.title} className="w-full h-full object-cover" />
                                        <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                            {isActive && isPlaying
                                                ? <Pause size={16} className="text-accent" fill="currentColor" />
                                                : <Play size={16} className="text-white ml-0.5" fill="currentColor" />
                                            }
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handlePlay(song.id)}>
                                        <h4 className={`font-semibold text-sm truncate ${isActive ? 'text-accent' : 'text-zinc-200'}`}>
                                            {song.title}
                                        </h4>
                                        <p className="text-xs text-zinc-600 truncate mt-0.5">
                                            {song.artist || 'Local Audio'} • {formatDuration(song.duration)}
                                        </p>
                                    </div>

                                    {/* Menu */}
                                    <div className="relative shrink-0">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMenuOpenId(menuOpenId === song.id ? null : song.id);
                                            }}
                                            className="p-2 text-zinc-500 hover:text-white transition-all rounded-full hover:bg-white/5"
                                        >
                                            <MoreVertical size={16} />
                                        </button>

                                        {menuOpenId === song.id && (
                                            <div
                                                className="absolute top-0 right-10 bg-surface/95 backdrop-blur-3xl border border-white/10 rounded-2xl p-1.5 min-w-[180px] shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-200"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    onClick={() => {
                                                        if (!queue.includes(song.id)) setQueue([...queue, song.id]);
                                                        setMenuOpenId(null);
                                                    }}
                                                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:bg-white/5 hover:text-white flex items-center gap-3"
                                                >
                                                    <ListMusic size={14} /> Add to Queue
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setPlaylistModalSongId(song.id);
                                                        setMenuOpenId(null);
                                                    }}
                                                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-zinc-300 hover:bg-white/5 hover:text-white flex items-center gap-3"
                                                >
                                                    <PlusCircle size={14} /> Add to Playlist
                                                </button>
                                                <div className="h-px bg-white/5 my-1 mx-2" />
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Delete this song?')) handleDelete(song.id);
                                                        setMenuOpenId(null);
                                                    }}
                                                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-400/10 flex items-center gap-3"
                                                >
                                                    <Trash2 size={14} /> Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div >
                )}

                {/* Import FAB */}
                {
                    songList.length > 0 && (
                        <button
                            onClick={() => navigate('/import')}
                            className="fixed bottom-24 right-5 md:bottom-8 md:right-8 w-14 h-14 rounded-full bg-accent text-black flex items-center justify-center shadow-[0_0_30px_rgba(var(--accent-rgb),0.4)] hover:shadow-[0_0_40px_rgba(var(--accent-rgb),0.6)] hover:scale-105 active:scale-95 transition-all z-90"
                        >
                            <DownloadCloud size={22} />
                        </button>
                    )
                }
            </div >

            {/* Playlist Modal */}
            {
                playlistModalSongId && (
                    <AddToPlaylistModal songId={playlistModalSongId} onClose={() => setPlaylistModalSongId(null)} />
                )
            }
        </PageTransition >
    );
};

export default Library;
