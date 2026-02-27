import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { useLibraryStore } from '../../store/libraryStore';
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, Clock } from 'lucide-react';

const PlayerModal: React.FC = () => {
    const {
        currentSongId,
        currentStreamMetadata,
        isPlaying,
        setIsPlaying,
        playNext,
        playPrevious,
        isShuffle,
        toggleShuffle,
        repeatMode,
        toggleRepeat,
        isExpanded,
        setIsExpanded,
        sleepTimer,
        setSleepTimer
    } = usePlayerStore();

    const { songs } = useLibraryStore();
    const [showTimerMenu, setShowTimerMenu] = useState(false);

    // Sleep Timer choices (minutes)
    const timerOptions = [null, 15, 30, 45, 60, 120];

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (sleepTimer !== null && sleepTimer > 0 && isPlaying) {
            interval = setInterval(() => {
                setSleepTimer(sleepTimer - 1);
            }, 60000); // subtract 1 minute every 60 seconds
        } else if (sleepTimer === 0) {
            setIsPlaying(false);
            setSleepTimer(null); // Reset timer
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [sleepTimer, isPlaying, setSleepTimer, setIsPlaying]);

    if (!isExpanded) return null;

    let songObj = currentSongId ? songs[currentSongId] : null;
    if (!songObj && currentStreamMetadata) {
        songObj = { ...currentStreamMetadata, duration: 0, dateAdded: 0, size: 0, playCount: 0 } as any;
    }

    if (!songObj) {
        return null;
    }

    const { title, artist, thumbnail } = songObj;
    const thumbUrl = thumbnail || `https://picsum.photos/seed/${currentSongId || 'stream'}/800/800`;

    return (
        <div className="fixed inset-0 z-100 flex flex-col bg-black overflow-hidden animate-fade-in">
            {/* Blurred Background */}
            <div
                className="absolute inset-0 bg-cover bg-center opacity-40 blur-3xl scale-110"
                style={{ backgroundImage: `url(${thumbUrl})` }}
            />
            <div className="absolute inset-0 bg-linear-to-b from-black/40 via-black/60 to-black lg:to-black/80" />

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between p-6">
                <button
                    onClick={() => setIsExpanded(false)}
                    className="p-2 text-zinc-300 hover:text-white transition-colors glass-card rounded-full"
                >
                    <ChevronDown size={28} />
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-xs font-bold tracking-widest text-zinc-400">NOW PLAYING</span>
                    <span className="text-sm font-semibold theme-gradient-text tracking-widest text-[#0073ff]">ANTI-GRAVITY</span>
                </div>
                {/* Sleep Timer Menu */}
                <div className="relative">
                    <button
                        onClick={() => setShowTimerMenu(!showTimerMenu)}
                        className={`p-2 transition-colors glass-card rounded-full flex items-center gap-2 ${sleepTimer !== null ? 'text-[#00ccff]' : 'text-zinc-300 hover:text-white'}`}
                    >
                        <Clock size={20} />
                        {sleepTimer !== null && <span className="text-xs font-bold">{sleepTimer}m</span>}
                    </button>

                    {showTimerMenu && (
                        <div className="absolute top-12 right-0 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 min-w-[150px] shadow-2xl animate-scale-in">
                            <h4 className="text-xs text-zinc-400 font-bold px-3 py-2 mb-1 border-b border-white/10 tracking-wider">SLEEP TIMER</h4>
                            {timerOptions.map(opt => (
                                <button
                                    key={opt || 'off'}
                                    onClick={() => { setSleepTimer(opt); setShowTimerMenu(false); }}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${sleepTimer === opt ? 'bg-white/20 text-white' : 'text-zinc-300 hover:bg-white/10 hover:text-white'}`}
                                >
                                    {opt === null ? 'Off' : `${opt} Minutes`}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-8 max-w-[600px] w-full mx-auto">

                {/* Artwork */}
                <div className={`w-full aspect-square max-w-[400px] rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] transition-transform duration-700 ease-out mb-12 ${isPlaying ? 'scale-100' : 'scale-90'}`}>
                    <img src={thumbUrl} alt={title} className="w-full h-full object-cover" />
                </div>

                {/* Track Info */}
                <div className="w-full text-center mb-10">
                    <h2 className="text-3xl md:text-4xl font-black text-white mb-2 line-clamp-1">{title}</h2>
                    <p className="text-lg text-zinc-400 line-clamp-1">{artist || 'Unknown Artist'}</p>
                </div>

                {/* Scrubber Placeholder - The actual <audio> element is in BottomPlayer. We could sync state here if desired, but for now just basic controls */}
                <div className="w-full h-1.5 bg-white/10 rounded-full mb-10 relative overflow-hidden">
                    {/* Simulated progress for visual flavor, real progress requires moving audio ref state up */}
                    <div className="absolute left-0 top-0 bottom-0 bg-linear-to-r from-[#00ccff] to-[#0073ff] w-1/3 rounded-full opacity-50" />
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-8 w-full">
                    <button onClick={toggleShuffle} className={`transition-all hover:scale-110 ${isShuffle ? 'text-[#00ccff]' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        <Shuffle size={24} />
                    </button>

                    <button onClick={playPrevious} className="text-zinc-300 hover:text-white hover:scale-110 transition-all drop-shadow-md">
                        <SkipBack size={36} />
                    </button>

                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`relative w-20 h-20 rounded-full flex items-center justify-center group/play transition-transform active:scale-95`}
                    >
                        <div className={`absolute inset-0 rounded-full blur-xl opacity-50 transition-all duration-500 ${isPlaying ? 'bg-white scale-110' : 'bg-transparent scale-100'}`} />
                        <div className="absolute inset-0 rounded-full bg-white/10 border border-white/20 backdrop-blur-md" />

                        {isPlaying ? <Pause size={32} className="relative z-10 text-white fill-white" /> : <Play size={32} className="relative z-10 text-white fill-white ml-2" />}
                    </button>

                    <button onClick={playNext} className="text-zinc-300 hover:text-white hover:scale-110 transition-all drop-shadow-md">
                        <SkipForward size={36} />
                    </button>

                    <button onClick={toggleRepeat} className={`transition-all relative hover:scale-110 ${repeatMode !== 'OFF' ? 'text-[#00ccff]' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        <Repeat size={24} />
                        {repeatMode === 'ONE' && <span className="absolute -top-2 -right-2 text-[10px] font-black bg-white text-black px-1.5 rounded-full">1</span>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PlayerModal;
