import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX, X, Maximize2, ChevronUp, ChevronDown } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useLibraryStore } from '../../store/libraryStore';
import { useUIStore } from '../../store/uiStore';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import AudioVisualizer from '../visualizer/AudioVisualizer';
import MiniRobo from '../common/MiniRobo';
import SlimePet from '../common/SlimePet';

const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const BottomPlayer: React.FC = () => {
    const { currentSongId, currentStreamMetadata, isPlaying, volume, repeatMode, isShuffle, isBuffering,
        setIsPlaying, setVolume, toggleShuffle, toggleRepeat, playNext, playPrevious } = usePlayerStore();
    const { songs } = useLibraryStore();
    const { showPets } = useUIStore();

    const { currentTime, duration, seek, isReady, analyzer } = useAudioPlayer();

    const [localVolume, setLocalVolume] = useState(volume);
    const [isDraggingSeek, setIsDraggingSeek] = useState(false);
    const [localSeek, setLocalSeek] = useState(0);
    const [isMinimized, setIsMinimized] = useState(false);
    const navigate = useNavigate();

    const song = currentStreamMetadata || (currentSongId ? songs[currentSongId] : null);

    useEffect(() => { setLocalVolume(volume); }, [volume]);

    const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setIsDraggingSeek(true);
        setLocalSeek(Number(e.target.value));
    };

    const handleSeekEnd = () => {
        setIsDraggingSeek(false);
        seek(localSeek);
    };

    const currentDisplayTime = isDraggingSeek ? localSeek : currentTime;
    const progressPercent = duration ? (currentDisplayTime / duration) * 100 : 0;

    if (!song) return null;

    // ─── MINIMIZED: Ultra compact single-line bar ───
    if (isMinimized) {
        return (
            <div className="w-full max-w-[1600px] mx-auto">
                <div
                    className="relative rounded-2xl glass-panel-dark group shadow-[0_8px_30px_rgba(0,0,0,0.6)] z-10 w-full overflow-hidden cursor-pointer"
                    onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button')) return;
                        navigate('/now-playing');
                    }}
                >
                    {/* Progress line */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5">
                        <div
                            className="h-full bg-accent transition-all ease-linear"
                            style={{ width: `${progressPercent}%`, transitionDuration: '200ms' }}
                        />
                    </div>

                    <div className="flex items-center gap-2 p-2 pr-1">
                        {/* Tiny thumbnail */}
                        <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-zinc-900">
                            <img src={song.thumbnail || `https://picsum.photos/seed/${song.id || 'stream'}/100/100`} alt="" className="w-full h-full object-cover" />
                        </div>

                        {/* Title + Buffering */}
                        <div className="flex-1 min-w-0">
                            <h4 className="text-white font-semibold text-xs truncate">{song.title}</h4>
                            {isBuffering && (
                                <p className="text-accent text-[9px] font-medium animate-pulse">Buffering stream...</p>
                            )}
                        </div>

                        {/* Play/Pause + Expand */}
                        {isBuffering ? (
                            <div className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin shrink-0" />
                        ) : (
                            <button
                                onClick={() => setIsPlaying(!isPlaying)}
                                className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0"
                            >
                                {isPlaying
                                    ? <Pause size={14} className="text-black fill-black" />
                                    : <Play size={14} className="text-black fill-black ml-0.5" />
                                }
                            </button>
                        )}

                        <button
                            onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
                            className="p-1.5 text-zinc-600 hover:text-white transition-colors"
                        >
                            <ChevronUp size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── FULL: Expanded player bar ───
    return (
        <div className="w-full max-w-[1600px] mx-auto transition-all">
            {showPets && <MiniRobo analyzer={analyzer} isPlaying={isPlaying} />}
            {showPets && <SlimePet analyzer={analyzer} isPlaying={isPlaying} />}

            <div
                className="relative rounded-2xl md:rounded-3xl glass-panel-dark group shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-10 w-full overflow-hidden cursor-pointer"
                onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
                    navigate('/now-playing');
                }}
            >
                {/* Subtle Visualizer Background */}
                {isPlaying && isReady && (
                    <div className="absolute inset-0 z-0 opacity-20 mix-blend-screen pointer-events-none">
                        <AudioVisualizer analyzer={analyzer} isPlaying={isPlaying} className="w-full h-full scale-[1.5]" />
                    </div>
                )}

                {/* Theme progress line at top */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5 z-20">
                    <div
                        className="h-full bg-linear-to-r from-accent to-accent/50 transition-all ease-linear"
                        style={{ width: `${progressPercent}%`, transitionDuration: isDraggingSeek ? '0ms' : '200ms' }}
                    />
                </div>

                <div className="relative z-10 p-2.5 md:p-4 flex flex-col md:flex-row items-center gap-2 md:gap-6 select-none">
                    {/* Left: Track Info */}
                    <div className="flex items-center gap-3 w-full md:w-[30%] shrink-0 px-1">
                        <div className={`relative w-11 h-11 md:w-14 md:h-14 rounded-xl bg-zinc-900 flex shrink-0 shadow-lg overflow-hidden transition-all duration-500 ${isPlaying ? 'scale-105' : ''}`}>
                            <img src={song.thumbnail || `https://picsum.photos/seed/${song.id || 'stream'}/400/400`} alt="art" className="w-full h-full object-cover" />
                        </div>

                        <div className="flex flex-col overflow-hidden flex-1">
                            <h4 className="text-white font-bold text-sm truncate">{song.title}</h4>
                            <p className="text-zinc-500 text-xs truncate mt-0.5">
                                {song.artist || 'Local Audio'}
                                {currentStreamMetadata && <span className="ml-1.5 text-[9px] text-accent bg-accent/10 px-1 py-0.5 rounded tracking-wider">STREAM</span>}
                            </p>
                        </div>

                        {/* Minimize button - mobile */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
                            className="md:hidden p-1.5 text-zinc-600 hover:text-white transition-colors shrink-0"
                            title="Minimize"
                        >
                            <ChevronDown size={18} />
                        </button>
                    </div>

                    {/* Center: Controls */}
                    <div className="flex flex-col items-center justify-center w-full md:flex-1 gap-2 relative">
                        <div className="flex items-center justify-center gap-4 md:gap-6 relative z-10">
                            {/* Shuffle - now visible on all screens */}
                            <button onClick={toggleShuffle} className={`transition-all hover:scale-110 ${isShuffle ? 'text-accent gold-glow-text' : 'text-zinc-600 hover:text-zinc-300'}`}>
                                <Shuffle size={15} />
                            </button>

                            <button onClick={playPrevious} className="text-zinc-400 hover:text-white hover:scale-110 transition-all">
                                <SkipBack size={18} />
                            </button>

                            <button
                                onClick={() => setIsPlaying(!isPlaying)}
                                disabled={!isReady && !isBuffering}
                                className={`relative w-11 h-11 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-transform active:scale-95 ${!isReady && !isBuffering ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <div className={`absolute inset-0 rounded-full transition-all duration-500 ${isPlaying ? 'bg-accent shadow-[0_0_25px_rgba(var(--accent-rgb),0.5)]' : 'bg-white/10 border border-white/20'}`} />
                                {isBuffering ? (
                                    <div className="relative z-10 w-5 h-5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                                ) : isPlaying
                                    ? <Pause size={18} className="relative z-10 text-black fill-black" />
                                    : <Play size={18} className="relative z-10 text-white fill-white ml-0.5" />
                                }
                            </button>

                            <button onClick={playNext} className="text-zinc-400 hover:text-white hover:scale-110 transition-all">
                                <SkipForward size={18} />
                            </button>

                            {/* Repeat - now visible on all screens */}
                            <button onClick={toggleRepeat} className={`transition-all relative hover:scale-110 ${repeatMode !== 'OFF' ? 'text-accent gold-glow-text' : 'text-zinc-600 hover:text-zinc-300'}`}>
                                <Repeat size={15} />
                                {repeatMode === 'ONE' && <span className="absolute -top-1.5 -right-2 text-[9px] font-black bg-accent text-black px-1 rounded-full">1</span>}
                            </button>
                        </div>

                        {/* Seek Bar */}
                        <div className="flex items-center gap-3 w-full max-w-xl px-2 mt-1 md:mt-0">
                            <span className="text-[10px] text-zinc-500 font-mono w-9 text-right tabular-nums">{formatTime(currentDisplayTime)}</span>

                            <div className="flex-1 relative h-5 flex items-center group/slider cursor-pointer" onMouseDown={() => setIsDraggingSeek(true)} onTouchStart={() => setIsDraggingSeek(true)}>
                                <input
                                    type="range"
                                    min={0}
                                    max={duration || 100}
                                    value={currentDisplayTime}
                                    onChange={handleSeekChange}
                                    onMouseUp={handleSeekEnd}
                                    onTouchEnd={handleSeekEnd}
                                    className="absolute w-full h-full opacity-0 cursor-pointer z-20"
                                />
                                <div className="w-full h-1 bg-white/5 rounded-full relative overflow-hidden">
                                    <div
                                        className="absolute top-0 left-0 h-full bg-linear-to-r from-accent/60 to-accent rounded-full transition-all ease-linear"
                                        style={{ width: `${progressPercent}%`, transitionDuration: isDraggingSeek ? '0ms' : '200ms' }}
                                    />
                                </div>
                                <div
                                    className="absolute w-3 h-3 bg-accent rounded-full shadow-[0_0_10px_rgba(var(--accent-rgb),0.6)] pointer-events-none z-10 transition-transform scale-0 group-hover/slider:scale-100"
                                    style={{ left: `calc(${progressPercent}% - 6px)` }}
                                />
                            </div>

                            <span className="text-[10px] text-zinc-600 font-mono w-9 tabular-nums">{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Right: Volume, Expand & Close */}
                    <div className="flex items-center justify-end w-auto lg:w-[20%] shrink-0 gap-2 pr-1 relative">
                        <div className="hidden lg:flex items-center gap-2 px-2 py-1.5 rounded-full hover:bg-white/3 transition-colors group/vol">
                            <button onClick={() => setVolume(volume === 0 ? 1 : 0)} className="text-zinc-500 group-hover/vol:text-white transition-colors">
                                {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                            </button>
                            <div className="w-16 relative h-4 flex items-center cursor-pointer">
                                <input type="range" min={0} max={1} step={0.01} value={localVolume}
                                    onChange={(e) => { const v = Number(e.target.value); setLocalVolume(v); setVolume(v); }}
                                    className="absolute w-full h-full opacity-0 cursor-pointer z-20"
                                />
                                <div className="w-full h-0.5 bg-zinc-800 rounded-full relative overflow-hidden">
                                    <div className="absolute top-0 left-0 h-full bg-zinc-400 group-hover/vol:bg-accent rounded-full transition-colors" style={{ width: `${localVolume * 100}%` }} />
                                </div>
                            </div>
                        </div>

                        <button onClick={() => navigate('/now-playing')} className="hidden lg:block p-2 text-zinc-500 hover:text-white transition-colors rounded-full hover:bg-white/5" title="Now Playing">
                            <Maximize2 size={16} />
                        </button>

                        {/* Minimize button - desktop */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
                            className="hidden md:block p-2 text-zinc-500 hover:text-white transition-colors rounded-full hover:bg-white/5"
                            title="Minimize"
                        >
                            <ChevronDown size={16} />
                        </button>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsPlaying(false);
                                usePlayerStore.getState().clearStream();
                                usePlayerStore.getState().clearQueue();
                            }}
                            className="p-2 rounded-full transition-colors text-zinc-600 hover:text-red-400 hover:bg-red-400/10"
                            title="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BottomPlayer;
