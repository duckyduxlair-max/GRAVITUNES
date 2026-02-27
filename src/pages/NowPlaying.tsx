import React, { useState, useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { useUIStore } from '../store/uiStore';
import { Play, Pause, SkipBack, SkipForward, ChevronDown, Heart, Shuffle, Repeat, ListPlus, Eye, EyeOff, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import WaveProgress from '../components/player/WaveProgress';
import SlimePet from '../components/common/SlimePet';
import MiniRobo from '../components/common/MiniRobo';
import { saveAudioBlob } from '../services/db';
import { getAudioDuration } from '../services/audioService';
import { useDownloadStore } from '../store/downloadStore';

import { globalAnalyzer } from '../hooks/useAudioPlayer';

const NowPlaying: React.FC = () => {
    const {
        currentSongId, currentStreamMetadata, isPlaying, setIsPlaying,
        playNext, playPrevious, isShuffle, toggleShuffle, repeatMode, toggleRepeat,
        isBuffering
    } = usePlayerStore();

    const { songs, playlists, addSong, addSongToPlaylist, removeSongFromPlaylist } = useLibraryStore();
    const { showPets, togglePets } = useUIStore();
    const navigate = useNavigate();
    const [playlistModalOpen, setPlaylistModalOpen] = useState(false);

    // Direct DOM refs — zero re-render animation
    const artworkRef = useRef<HTMLImageElement>(null);
    const rippleRefs = useRef<(HTMLDivElement | null)[]>([]);
    const glowRef = useRef<HTMLDivElement>(null);
    const bassRef = useRef(0);
    const breathBgRef = useRef<HTMLDivElement>(null);

    // Refs for bass-reactive transport buttons (no more React state for bass)
    const playBtnRef = useRef<HTMLButtonElement>(null);
    const prevBtnRef = useRef<HTMLButtonElement>(null);
    const nextBtnRef = useRef<HTMLButtonElement>(null);
    const shuffleBtnRef = useRef<HTMLButtonElement>(null);
    const repeatBtnRef = useRef<HTMLButtonElement>(null);
    const heartBtnRef = useRef<HTMLButtonElement>(null);

    // 60fps bass-reactive animation — 100% direct DOM, ZERO React re-renders
    useEffect(() => {
        let frameId: number;
        const animate = () => {
            if (globalAnalyzer && isPlaying) {
                const arr = new Uint8Array(64);
                globalAnalyzer.getByteFrequencyData(arr);
                let bassSum = 0;
                for (let i = 0; i < 12; i++) bassSum += arr[i];
                const bass = Math.pow(bassSum / 12 / 255, 0.6);
                bassRef.current = bass;

                // Ripples — capped sizes, smaller scale, contained
                rippleRefs.current.forEach((el, i) => {
                    if (!el) return;
                    const w = Math.min(28 + i * 18 + bass * 40, 82); // hard cap at 82%
                    el.style.width = `${w}%`;
                    el.style.opacity = `${Math.max(0, Math.min((0.4 - i * 0.08) + bass * 0.5, 0.85))}`;
                    const s = 1 + bass * 0.08 * (i + 1); // much gentler scale
                    el.style.transform = `scale(${s}) rotate(${bass * 12 * (i + 1)}deg) translateZ(0)`;
                    const spread = Math.min(15 + bass * 30, 30); // cap shadow spread
                    el.style.boxShadow = `0 0 ${spread}px rgba(var(--accent-rgb), ${Math.min(0.25 + bass * 0.35, 0.55)})`;
                });

                // Album art — subtle scale, no blinking
                if (artworkRef.current) {
                    const s = 1 + bass * 0.12; // reduced from 0.7
                    artworkRef.current.style.transform = `scale(${s})`;
                    artworkRef.current.style.filter = `brightness(${1 + bass * 0.2}) contrast(${1 + bass * 0.1}) saturate(${1 + bass * 0.15})`;
                }

                // Glow
                if (glowRef.current) {
                    glowRef.current.style.opacity = `${Math.min(bass * 0.7, 0.65)}`;
                }

                // Breathing background — direct DOM
                if (breathBgRef.current) {
                    breathBgRef.current.style.background = `radial-gradient(circle at 50% 50%, rgba(var(--accent-rgb), ${0.08 + bass * 0.12}) 0%, transparent 70%)`;
                    breathBgRef.current.style.opacity = `${0.4 + bass * 0.4}`;
                }

                // Transport buttons — direct DOM, no React re-renders
                if (playBtnRef.current) playBtnRef.current.style.transform = `scale(${1 + bass * 0.06})`;
                if (prevBtnRef.current) prevBtnRef.current.style.transform = `scale(${1 + bass * 0.03})`;
                if (nextBtnRef.current) nextBtnRef.current.style.transform = `scale(${1 + bass * 0.03})`;

                // Only scale shuffle/repeat/heart if active (check via data attr)
                if (shuffleBtnRef.current && shuffleBtnRef.current.dataset.active === 'true') {
                    shuffleBtnRef.current.style.transform = `scale(${1 + bass * 0.06})`;
                }
                if (repeatBtnRef.current && repeatBtnRef.current.dataset.active === 'true') {
                    repeatBtnRef.current.style.transform = `scale(${1 + bass * 0.06})`;
                }
                if (heartBtnRef.current && heartBtnRef.current.dataset.active === 'true') {
                    heartBtnRef.current.style.transform = `scale(${1 + bass * 0.08})`;
                }
            } else {
                bassRef.current = 0;
                rippleRefs.current.forEach((el) => {
                    if (!el) return;
                    el.style.opacity = '0';
                    el.style.transform = 'scale(1) rotate(0deg) translateZ(0)';
                    el.style.boxShadow = 'none';
                });
                if (artworkRef.current) {
                    artworkRef.current.style.transform = 'scale(1)';
                    artworkRef.current.style.filter = 'brightness(1) contrast(1) saturate(1)';
                }
                if (glowRef.current) glowRef.current.style.opacity = '0';
                if (breathBgRef.current) breathBgRef.current.style.opacity = '0';
                if (playBtnRef.current) playBtnRef.current.style.transform = 'scale(1)';
                if (prevBtnRef.current) prevBtnRef.current.style.transform = 'scale(1)';
                if (nextBtnRef.current) nextBtnRef.current.style.transform = 'scale(1)';
                if (shuffleBtnRef.current) shuffleBtnRef.current.style.transform = 'scale(1)';
                if (repeatBtnRef.current) repeatBtnRef.current.style.transform = 'scale(1)';
                if (heartBtnRef.current) heartBtnRef.current.style.transform = 'scale(1)';
            }
            frameId = requestAnimationFrame(animate);
        };
        animate();
        return () => cancelAnimationFrame(frameId);
    }, [isPlaying]);

    const song = currentStreamMetadata || (currentSongId ? songs[currentSongId] : null);
    const songId = currentSongId || currentStreamMetadata?.id;
    const favoriteSongIds = playlists['favorites']?.songIds || [];
    const isFavorite = !!(songId && favoriteSongIds.includes(songId));
    const thumb = song?.thumbnail || `https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=800&auto=format&fit=crop`;

    if (!song) {
        return (
            <PageTransition>
                <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-base">
                    <div className="w-28 h-28 rounded-3xl glass-panel flex items-center justify-center mb-6">
                        <span className="text-4xl text-accent/50">♫</span>
                    </div>
                    <h2 className="text-lg font-bold tracking-wide text-white font-['Outfit'] mb-2">Nothing Playing</h2>
                    <p className="text-zinc-500 text-sm max-w-xs text-center">Select a song to begin listening.</p>
                </div>
            </PageTransition>
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_isDownloading, setIsDownloading] = useState(false);

    const toggleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!songId) return;

        if (!isFavorite) {
            const needsDownload = !songs[songId] && !!currentStreamMetadata;
            const meta = currentStreamMetadata;

            // DON'T add song metadata here — wait for download to finish with real duration
            // Only add to favorites playlist immediately (will be fulfilled after download)
            addSongToPlaylist('favorites', songId);

            if (needsDownload && meta) {
                setIsDownloading(true);
                const dlId = `dl_${meta.id}_${Date.now()}`;
                useDownloadStore.getState().addDownload({
                    id: dlId,
                    songId,
                    title: meta.title,
                    status: 'downloading',
                    progress: 0,
                    speed: '...',
                    size: 0,
                });
                (async () => {
                    try {
                        const API_BASE = import.meta.env.VITE_API_URL || '/api';
                        const streamUrl = `${API_BASE}/stream?v=${meta.id}`;
                        const response = await fetch(streamUrl);
                        if (response.ok && response.body) {
                            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
                            const reader = response.body.getReader();
                            const chunks: Uint8Array[] = [];
                            let totalBytes = 0;
                            const startTime = Date.now();
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                if (value) {
                                    chunks.push(value);
                                    totalBytes += value.length;
                                    // Update progress
                                    const elapsed = (Date.now() - startTime) / 1000;
                                    const speed = elapsed > 0 ? `${(totalBytes / 1024 / elapsed).toFixed(0)} KB/s` : '...';
                                    const progress = contentLength > 0 ? Math.round((totalBytes / contentLength) * 100) : 0;
                                    useDownloadStore.getState().updateDownload(dlId, { progress, speed, size: totalBytes });
                                }
                            }
                            const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
                            await saveAudioBlob(songId, blob);
                            // Compute real duration from downloaded blob
                            const blobUrl = URL.createObjectURL(blob);
                            const realDuration = await getAudioDuration(blobUrl);
                            URL.revokeObjectURL(blobUrl);
                            addSong({
                                id: songId,
                                title: meta.title,
                                originalUrl: streamUrl,
                                duration: realDuration || 0,
                                size: totalBytes,
                                dateAdded: Date.now(),
                                playCount: 0,
                                thumbnail: meta.thumbnail,
                                artist: meta.artist,
                            });
                            useDownloadStore.getState().updateDownload(dlId, { status: 'completed', progress: 100 });
                        } else {
                            useDownloadStore.getState().updateDownload(dlId, { status: 'failed' });
                        }
                    } catch (err) {
                        console.error('Background auto-download on like failed:', err);
                        useDownloadStore.getState().updateDownload(dlId, { status: 'failed' });
                    } finally {
                        setIsDownloading(false);
                    }
                })();
            }
        } else {
            removeSongFromPlaylist('favorites', songId);
        }
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: song.title,
                text: `Listening to ${song.title} on GraviTunes`,
                url: window.location.href
            }).catch(() => { });
        }
    };

    return (
        <PageTransition>
            <div className="w-full h-dvh flex flex-col bg-base relative overflow-hidden font-['Inter']">
                {/* Parallax Depth Background */}
                <div className="absolute inset-0 z-0 select-none pointer-events-none transform-gpu overflow-hidden">
                    <img
                        src={thumb}
                        className="w-full h-full object-cover blur-[100px] opacity-30 transform scale-150"
                        alt=""
                    />
                    {/* Bass-Reactive Breathing Background — direct DOM ref */}
                    <div
                        ref={breathBgRef}
                        className="absolute inset-0"
                        style={{ opacity: 0 }}
                    />
                    <div className="absolute inset-0 bg-base/40" />
                    <div className="absolute inset-0 bg-linear-to-b from-transparent via-base/60 to-base" />
                </div>

                {/* Pets */}
                {showPets && (
                    <div className="absolute inset-0 pointer-events-none z-10">
                        <MiniRobo analyzer={globalAnalyzer as AnalyserNode | null} isPlaying={isPlaying} />
                        <SlimePet analyzer={globalAnalyzer as AnalyserNode | null} isPlaying={isPlaying} />
                    </div>
                )}

                <div className="relative z-20 w-full h-full flex flex-col items-center justify-between px-4 py-6 sm:px-6 sm:py-8 max-w-lg mx-auto">
                    {/* Top Bar */}
                    <div className="flex items-center justify-between w-full shrink-0">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-xl flex items-center justify-center text-white hover:bg-white/10 transition-all border border-white/10 active:scale-95"
                        >
                            <ChevronDown size={22} />
                        </button>
                        <div className="flex flex-col items-center group">
                            <h1 className="text-[10px] sm:text-[11px] uppercase font-black tracking-[0.45em] text-accent/90 gold-glow-text leading-none">GraviTunes</h1>
                            <span className="text-[9px] font-bold text-white/20 tracking-[0.3em] uppercase mt-1.5 opacity-60 group-hover:opacity-100 transition-opacity">Dynamic Hero</span>
                        </div>
                        <button
                            onClick={handleShare}
                            className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-xl flex items-center justify-center text-white hover:bg-white/10 transition-all border border-white/10 active:scale-95"
                        >
                            <Share2 size={18} />
                        </button>
                    </div>

                    {/* Central Hero: Album Art + Contained Squircle Bass Ripples */}
                    <div
                        className="relative flex items-center justify-center flex-1 w-full py-2"
                        style={{ contain: 'layout style paint' }}
                    >
                        {/* Ripple Container — CONTAINED, overflow-hidden, will not bleed out */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    ref={(el) => { rippleRefs.current[i] = el; }}
                                    className="absolute rounded-[24%] border-[1.5px] border-accent/40"
                                    style={{
                                        width: '25%',
                                        aspectRatio: '1',
                                        opacity: 0,
                                        transition: 'none',
                                        willChange: 'transform, opacity',
                                        backfaceVisibility: 'hidden',
                                    }}
                                />
                            ))}
                        </div>

                        {/* Album Art Container — Smaller for mobile responsiveness */}
                        <div
                            className="relative aspect-square w-[48%] max-w-[180px] rounded-[24px] shadow-[0_24px_60px_rgba(0,0,0,0.7)] z-10 p-0.5 bg-white/5 border border-white/10"
                        >
                            <div className="w-full h-full rounded-[22px] overflow-hidden bg-surface relative">
                                <img
                                    ref={artworkRef}
                                    src={thumb}
                                    alt={song.title}
                                    className="w-full h-full object-cover origin-center will-change-transform"
                                    style={{ transition: 'none', backfaceVisibility: 'hidden' }}
                                />
                                <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent pointer-events-none" />
                            </div>

                            {/* Inner Shine Overlay */}
                            <div className="absolute inset-0 rounded-[24px] ring-1 ring-inset ring-white/20 pointer-events-none glass-shine" />

                            {/* Bass Reactive Glow — capped opacity */}
                            <div
                                ref={glowRef}
                                className="absolute -inset-3 rounded-[28px] blur-2xl z-[-1]"
                                style={{
                                    background: `rgba(var(--accent-rgb), 0.35)`,
                                    opacity: 0,
                                    transition: 'none',
                                    willChange: 'opacity',
                                }}
                            />
                        </div>
                    </div>

                    {/* Song Info */}
                    <div className="relative z-30 flex flex-col items-center w-full shrink-0 mb-4 text-center px-2">
                        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tighter font-['Outfit'] line-clamp-2 leading-tight mb-1.5">
                            {song.title}
                        </h2>
                        <p className="text-white/40 font-semibold tracking-wide uppercase text-[10px]">
                            {song.artist || 'Independent Artist'}
                        </p>
                    </div>

                    {/* Progressive Seeker */}
                    <div className="w-full shrink-0 mb-6 px-2">
                        <WaveProgress />
                    </div>

                    {/* Main Transport Controls — all via refs, zero re-renders */}
                    <div className="w-full flex items-center justify-between shrink-0 px-2 mb-2 gap-2">
                        <button
                            ref={shuffleBtnRef}
                            data-active={isShuffle ? 'true' : 'false'}
                            onClick={toggleShuffle}
                            className={`p-2.5 rounded-full transition-colors active:scale-90 ${isShuffle ? 'text-accent gold-glow-text bg-accent/5' : 'text-white/20 hover:text-white/40'}`}
                        >
                            <Shuffle size={18} />
                        </button>

                        <button
                            ref={prevBtnRef}
                            onClick={playPrevious}
                            className="w-11 h-11 rounded-full flex items-center justify-center text-white/80 hover:text-white bg-white/5 border border-white/5 active:scale-90 transition-colors"
                        >
                            <SkipBack size={22} fill="currentColor" />
                        </button>

                        <button
                            ref={playBtnRef}
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center group active:scale-95 transition-colors shadow-2xl"
                        >
                            {/* Outer Pulse */}
                            <div className={`absolute -inset-1.5 rounded-full transition-opacity duration-300 blur-lg ${isPlaying ? 'bg-accent/30 opacity-100' : 'bg-white/5 opacity-0'}`} />

                            <div className={`absolute inset-0 rounded-full transition-colors duration-500 border-2 ${isPlaying
                                ? 'bg-accent border-white/20 shadow-[0_0_25px_rgba(var(--accent-rgb),0.4)]'
                                : 'bg-white/10 border-white/10 backdrop-blur-2xl'
                                }`} />

                            {isBuffering ? (
                                <div className="relative z-10 w-7 h-7 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                            ) : isPlaying
                                ? <Pause size={28} fill="currentColor" className="relative z-10 text-black" />
                                : <Play size={28} fill="currentColor" className="relative z-10 text-white ml-1" />
                            }
                        </button>

                        <button
                            ref={nextBtnRef}
                            onClick={playNext}
                            className="w-11 h-11 rounded-full flex items-center justify-center text-white/80 hover:text-white bg-white/5 border border-white/5 active:scale-90 transition-colors"
                        >
                            <SkipForward size={22} fill="currentColor" />
                        </button>

                        <button
                            ref={repeatBtnRef}
                            data-active={repeatMode !== 'OFF' ? 'true' : 'false'}
                            onClick={toggleRepeat}
                            className={`p-2.5 rounded-full transition-colors active:scale-90 ${repeatMode !== 'OFF' ? 'text-accent gold-glow-text bg-accent/5' : 'text-white/20 hover:text-white/40'}`}
                        >
                            <Repeat size={18} />
                        </button>
                    </div>

                    {/* Bottom Utility Bar */}
                    <div className="flex items-center justify-between w-full px-3 pt-1 pb-1 gap-2">
                        <button
                            onClick={() => setPlaylistModalOpen(true)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-all active:scale-95"
                        >
                            <ListPlus size={13} /> Playlist
                        </button>

                        <div className="flex gap-3">
                            <button
                                onClick={togglePets}
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${showPets ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-white/5 text-white/20'}`}
                            >
                                {showPets ? <Eye size={16} /> : <EyeOff size={16} />}
                            </button>
                            <button
                                ref={heartBtnRef}
                                data-active={isFavorite ? 'true' : 'false'}
                                onClick={toggleFavorite}
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors border ${isFavorite
                                    ? 'bg-accent/10 border-accent/20 shadow-[0_0_10px_rgba(var(--accent-rgb),0.15)]'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                            >
                                <Heart size={18} fill={isFavorite ? 'var(--accent)' : 'transparent'} className={isFavorite ? 'text-accent' : 'text-white/30'} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Playlist Modal Integration */}
                {playlistModalOpen && currentSongId && (
                    <div className="fixed inset-0 z-100 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl transition-all animate-in fade-in duration-300" onClick={() => setPlaylistModalOpen(false)}>
                        <div className="bg-surface/90 backdrop-blur-3xl sm:border border-white/10 rounded-t-[40px] sm:rounded-3xl p-8 w-full max-w-md shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-accent to-transparent opacity-50" />
                            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8 sm:hidden" />
                            <h3 className="text-center text-xl font-black text-white mb-6 font-['Outfit'] italic tracking-tight">ENLIST MOTION</h3>
                            <div className="space-y-3 max-h-[40dvh] overflow-y-auto mb-8 pr-2 scrollbar-hide overscroll-contain">
                                {Object.values(playlists)
                                    .filter(p => !p.isAutoGenerated)
                                    .map(playlist => (
                                        <button
                                            key={playlist.id}
                                            onClick={() => { addSongToPlaylist(playlist.id, currentSongId); setPlaylistModalOpen(false); }}
                                            className="w-full text-left px-6 py-5 rounded-2xl bg-white/3 hover:bg-accent/5 active:scale-95 transition-all text-white font-bold border border-white/5 flex items-center justify-between group"
                                        >
                                            <span className="group-hover:text-accent transition-colors">{playlist.name}</span>
                                            <span className="text-white/20 text-[10px] uppercase font-black tracking-widest">{playlist.songIds.length} tracks</span>
                                        </button>
                                    ))}
                            </div>
                            <button onClick={() => setPlaylistModalOpen(false)} className="w-full py-5 rounded-2xl bg-white/5 hover:bg-red-500/10 hover:text-red-400 text-white/50 font-black uppercase tracking-widest text-xs transition-all border border-transparent hover:border-red-500/20">
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </PageTransition>
    );
};

export default NowPlaying;
