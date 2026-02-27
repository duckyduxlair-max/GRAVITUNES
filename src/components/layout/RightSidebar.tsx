import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { usePlayerStore } from '../../store/playerStore';
import { useLibraryStore } from '../../store/libraryStore';
import { useUIStore } from '../../store/uiStore';
import { Library, Search, ListMusic, DownloadCloud, Settings, History, Disc3, Home, X } from 'lucide-react';

const RightSidebar: React.FC = () => {
    const { currentSongId, currentStreamMetadata } = usePlayerStore();
    const { songs } = useLibraryStore();
    const location = useLocation();
    const { isSidebarOpen, setSidebarOpen } = useUIStore();

    const currentSong = currentStreamMetadata || (currentSongId ? songs[currentSongId] : null);

    const playedSongs = Object.values(songs)
        .filter(s => s.playCount > 0)
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, 5);

    const navLinks = [
        { to: "/home", icon: <Home size={20} />, label: "Home" },
        { to: "/now-playing", icon: <Disc3 size={20} />, label: "Now Playing" },
        { to: "/library", icon: <Library size={20} />, label: "Library" },
        { to: "/search", icon: <Search size={20} />, label: "Search" },
        { to: "/playlists", icon: <ListMusic size={20} />, label: "Playlists" },
        { to: "/import", icon: <DownloadCloud size={20} />, label: "Import" },
        { to: "/settings", icon: <Settings size={20} />, label: "Settings" },
    ];

    return (
        <>
            {/* Mobile Backdrop */}
            <div
                className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-110 lg:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setSidebarOpen(false)}
            />

            <aside className={`
                fixed lg:relative inset-y-0 right-0 z-120 flex flex-col w-80 xl:w-96 shadow-2xl overflow-y-auto transition-transform duration-500 ease-in-out
                border-l border-white/5 bg-base/95 backdrop-blur-xl mt-10 lg:mt-0
                ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
                lg:flex 
            `}>

                {/* Header */}
                <div className="p-6 pb-2 flex items-center justify-between">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            {/* Premium GTM Logo */}
                            <span className="text-xl font-black italic tracking-tight text-transparent bg-clip-text bg-linear-to-r from-accent/60 via-accent to-accent/60 animate-gtm-shine bg-size-[200%_auto] leading-none drop-shadow-[0_0_8px_rgba(var(--accent-rgb),0.3)] glass-shine mb-2">
                                GTM
                            </span>
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                                    <h1
                                        className="text-2xl font-black italic tracking-tighter text-white font-['Outfit'] inline-block animate-typing"
                                        style={{ overflow: 'hidden', whiteSpace: 'nowrap', borderRight: '2px solid var(--color-accent)', animation: 'typing 3s steps(40, end), blink-caret .75s step-end infinite' }}
                                    >
                                        Gravi<span className="text-accent">Tunes</span>
                                    </h1>
                                </div>
                                <h1 className="text-xs font-bold tracking-[0.2em] text-zinc-500 mt-1 leading-none font-['Outfit'] uppercase">By Manasvi & Mayank</h1>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-all"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="px-4 py-4 space-y-1">
                    {navLinks.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) => `
                            flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 font-medium tracking-wide
                            ${isActive
                                    ? 'bg-accent/10 text-accent border border-accent/20'
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/3 border border-transparent'
                                }
                        `}
                        >
                            {link.icon}
                            <span>{link.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="w-full h-px bg-white/5 my-2" />

                {/* History */}
                <div className="px-6 mb-8 flex-1">
                    <div className="flex items-center gap-2 mb-4 text-white">
                        <History size={16} className="text-accent" />
                        <h2 className="text-sm font-bold tracking-wide uppercase">Listening History</h2>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {playedSongs.length > 0 ? playedSongs.map(song => {
                            const thumb = song.thumbnail || `https://picsum.photos/seed/${song.id}/100/100`;
                            return (
                                <div key={song.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group">
                                    <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                                        <img src={thumb} alt={song.title} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-xs font-semibold text-zinc-300 truncate group-hover:text-accent transition-colors">{song.title}</h4>
                                        <p className="text-[10px] text-zinc-600 truncate">{song.artist || 'Local Audio'}</p>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="text-center p-4 rounded-xl border border-dashed border-white/5">
                                <p className="text-xs text-zinc-600">No history yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Now Playing Card */}
                {currentSong && location.pathname !== '/now-playing' && (() => {
                    const thumb = currentSong.thumbnail || `https://picsum.photos/seed/${currentSong.id || 'stream'}/400/400`;
                    return (
                        <div className="mt-auto m-4 shrink-0 relative rounded-2xl overflow-hidden aspect-4/3 border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.7)] group">
                            <img src={thumb} alt={currentSong.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent p-4 pb-4 flex flex-col justify-end">
                                <h3 className="text-sm font-bold tracking-wide text-white truncate">{currentSong.title}</h3>
                                <p className="text-xs text-zinc-400 truncate">{currentSong.artist || 'System'}</p>
                            </div>
                        </div>
                    );
                })()}
            </aside>
        </>
    );
};

export default RightSidebar;
