import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Pause, ChevronRight, Sparkles } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useUIStore } from '../store/uiStore';
import { useLibraryStore } from '../store/libraryStore';
import PageTransition from '../components/layout/PageTransition';
import SlimePet from '../components/common/SlimePet';
import MiniRobo from '../components/common/MiniRobo';
import { globalAnalyzer } from '../hooks/useAudioPlayer';
import { getRecommendedSongs, type Recommendation } from '../services/recommendationEngine';

// Swiper
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectFade, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-fade';
import 'swiper/css/pagination';

interface TrendingResult {
    id: string;
    title: string;
    artist: string;
    thumbnail: string;
    duration: string;
    url: string;
    views: number;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const Home: React.FC = () => {
    const navigate = useNavigate();
    const { playDirectStream, currentStreamMetadata, isPlaying } = usePlayerStore();
    const { avatarUrl, setAvatarUrl, showPets } = useUIStore();

    const [trending, setTrending] = useState<TrendingResult[]>([]);
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [recommended, setRecommended] = useState<Recommendation[]>([]);
    const librarySongs = useLibraryStore(s => s.songs);

    // Refresh recommendations when library changes
    useEffect(() => {
        const recs = getRecommendedSongs(8);
        setRecommended(recs);
    }, [librarySongs]);

    // Greeting based on time of day
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const [isOffline, setIsOffline] = useState(false);

    // Auto-fetch trending on mount with randomized query
    useEffect(() => {
        // Time-of-day dynamic music curation
        const getTrendingQueries = () => {
            const hour = new Date().getHours();
            if (hour >= 5 && hour < 12) {
                // Morning: Sweet, startup, motivational
                return [
                    'soft bollywood morning songs',
                    'uplifting sunrise hits',
                    'morning meditation beats',
                    'acoustic morning grace',
                    'positive hindi songs'
                ];
            } else if (hour >= 12 && hour < 18) {
                // Afternoon: Latest, energetic + phonk
                return [
                    'latest energetic bollywood songs 2026',
                    'upbeat dance hits',
                    'new high energy songs',
                    'fast paced trending',
                    'phonk drift',
                    'gym phonk playlist'
                ];
            } else {
                // Night: Soft + lofi + some dark phonk vibe
                return [
                    'sweet soft lofi',
                    'calm relaxing piano',
                    'soft evening jazz',
                    'midnight slumber beats',
                    'peaceful ambient lofi',
                    'dark phonk',
                    'chill phonk'
                ];
            }
        };

        const trendingQueries = getTrendingQueries();
        const randomQuery = trendingQueries[Math.floor(Math.random() * trendingQueries.length)];

        const fetchTrending = async () => {
            try {
                // Short timeout to detect offline state
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);

                const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(randomQuery)}`, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!res.ok) throw new Error('Server not OK');

                const data = await res.json();
                if (data.results) {
                    setTrending(data.results);
                    localStorage.setItem('cachedTrending', JSON.stringify(data.results));
                    setIsOffline(false);
                }
            } catch (err) {
                console.warn('Failed to fetch trending, falling back to cache:', err);
                const cached = localStorage.getItem('cachedTrending');
                if (cached) {
                    try {
                        setTrending(JSON.parse(cached));
                    } catch (e) {
                        // Parse error
                    }
                }
                setIsOffline(true);
            } finally {
                setLoading(false);
            }
        };
        fetchTrending();
    }, []);

    const handleStream = (result: TrendingResult) => {
        const videoId = result.id;
        const streamUrl = `${API_BASE}/stream?v=${videoId}`;
        playDirectStream(streamUrl, {
            title: result.title,
            artist: result.artist,
            thumbnail: result.thumbnail,
            id: videoId,
        });
    };

    const isCurrentlyPlaying = (id: string) =>
        currentStreamMetadata?.id === id && isPlaying;

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Extract unique artists from trending
    const artists = trending
        .map(t => ({ name: t.artist, thumb: t.thumbnail }))
        .filter((a, i, arr) => arr.findIndex(x => x.name === a.name) === i)
        .slice(0, 8);

    return (
        <PageTransition>
            <div className="max-w-5xl mx-auto space-y-8 relative pb-16">

                {/* Offline Sticky Banner */}
                {isOffline && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full bg-red-500/10 border border-red-500/20 backdrop-blur-md rounded-xl p-3 flex items-center justify-center gap-2 text-red-200 text-xs shadow-lg mb-4"
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        Offline Mode: Showing cached results. Turn on Termux server for live data.
                    </motion.div>
                )}

                {/* Greeting Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <motion.p
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-zinc-500 text-sm tracking-wide"
                        >
                            {getGreeting()}
                        </motion.p>
                        <motion.h1
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-2xl md:text-3xl font-black italic tracking-tight text-white font-['Outfit'] mt-1"
                        >
                            Welcome Back
                        </motion.h1>
                    </div>

                    {/* Avatar */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="relative"
                    >
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-12 h-12 rounded-full overflow-hidden border-2 border-accent/30 hover:border-accent/60 transition-colors shadow-[0_0_20px_rgba(212,175,55,0.15)]"
                        >
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-linear-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                                    <span className="text-accent font-bold text-lg font-['Outfit']">A</span>
                                </div>
                            )}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarUpload}
                        />
                    </motion.div>
                </div>

                {/* Highlight Banner (Swiper) */}
                {trending.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="w-full relative rounded-3xl overflow-hidden glass-panel-dark h-[240px] md:h-[320px] shadow-2xl"
                    >
                        <Swiper
                            modules={[Autoplay, EffectFade, Pagination]}
                            effect="fade"
                            autoplay={{ delay: 4000, disableOnInteraction: false }}
                            pagination={{ clickable: true, dynamicBullets: true }}
                            loop={true}
                            className="w-full h-full group"
                        >
                            {trending.slice(0, 5).map((item) => {
                                const hdThumbnail = item.thumbnail?.replace('hqdefault.jpg', 'maxresdefault.jpg') || item.thumbnail;
                                const hour = new Date().getHours();
                                let bannerTag = "Top Pick";
                                let bannerTitle = item.title;

                                if (hour >= 5 && hour < 12) {
                                    bannerTag = "A Fresh Start";
                                } else if (hour >= 12 && hour < 18) {
                                    bannerTag = "Energetic Beats";
                                } else {
                                    bannerTag = "Soft Lofi & Jazz";
                                }

                                return (
                                    <SwiperSlide key={item.id} className="relative w-full h-full">
                                        {/* Background Image & Overlay */}
                                        <div className="absolute inset-0 bg-zinc-900/50">
                                            <img
                                                src={hdThumbnail}
                                                alt={item.title}
                                                className="w-full h-full object-cover"
                                                loading="eager"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    if (target.src !== item.thumbnail) {
                                                        target.src = item.thumbnail;
                                                    }
                                                }}
                                            />
                                            <div className="absolute inset-0 bg-linear-to-t from-base via-base/80 to-transparent" />
                                            <div className="absolute inset-0 bg-linear-to-r from-base via-base/50 to-transparent" />
                                        </div>

                                        {/* Content Info */}
                                        <div className="absolute bottom-0 left-0 p-6 md:p-8 w-full md:w-2/3 flex flex-col justify-end h-full z-10">
                                            <span className="text-[10px] uppercase font-bold tracking-[0.3em] text-accent mb-2 gold-glow-text">{bannerTag}</span>
                                            <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter text-white font-['Outfit'] leading-none mb-2 line-clamp-2">
                                                {bannerTitle}
                                            </h2>
                                            <p className="text-zinc-400 text-sm md:text-base font-medium mb-5">{item.artist}</p>

                                            <button
                                                onClick={() => handleStream(item)}
                                                className="w-max flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-bold hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                                            >
                                                <Play size={16} className="fill-black" /> Play Now
                                            </button>
                                        </div>
                                    </SwiperSlide>
                                )
                            })}
                        </Swiper>
                    </motion.div>
                )}

                {/* TRENDING Section */}
                <div>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mb-5"
                    >
                        <h2 className="text-5xl md:text-7xl font-black italic tracking-tighter text-white/6 font-['Outfit'] leading-none select-none">
                            TRENDING
                        </h2>
                        <h3 className="text-lg font-bold tracking-wide text-white -mt-5 md:-mt-7 ml-1 font-['Outfit'] glass-shine relative inline-block overflow-visible">
                            Trending <span className="text-accent">Now</span>
                        </h3>
                    </motion.div>

                    {/* Horizontal Scroll Cards */}
                    <div className="overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                        <div className="flex gap-4 w-max">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <div key={i} className="w-44 h-56 rounded-2xl bg-white/5 animate-pulse shrink-0" />
                                ))
                            ) : (
                                trending.slice(0, 10).map((item, i) => (
                                    <motion.div
                                        key={item.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 * i }}
                                        className="w-44 shrink-0 group cursor-pointer"
                                        onClick={() => handleStream(item)}
                                    >
                                        <div className="relative w-44 h-44 rounded-2xl overflow-hidden mb-3 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
                                            <img
                                                src={item.thumbnail}
                                                alt={item.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                            <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />

                                            {/* Play overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.5)]">
                                                    {isCurrentlyPlaying(item.id) ? (
                                                        <Pause size={20} className="text-black" />
                                                    ) : (
                                                        <Play size={20} className="text-black ml-0.5" />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Duration badge */}
                                            <span className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-zinc-300 px-1.5 py-0.5 rounded-md">
                                                {item.duration}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-semibold text-zinc-200 truncate group-hover:text-accent transition-colors">{item.title}</h4>
                                        <p className="text-xs text-zinc-600 truncate mt-0.5">{item.artist}</p>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Artists Section */}
                {artists.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        <h3 className="text-lg font-bold tracking-wide text-white font-['Outfit'] mb-4">
                            Popular <span className="text-accent">Artists</span>
                        </h3>
                        <div className="overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                            <div className="flex gap-5 w-max">
                                {artists.map((artist, i) => (
                                    <motion.button
                                        key={artist.name}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.1 * i + 0.5 }}
                                        whileHover={{ scale: 1.08 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => navigate(`/search?q=${encodeURIComponent(artist.name)}`)}
                                        className="flex flex-col items-center gap-2 shrink-0"
                                    >
                                        <div className="w-18 h-18 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-white/5 hover:border-accent/30 transition-colors shadow-lg">
                                            <img src={artist.thumb} alt={artist.name} className="w-full h-full object-cover" />
                                        </div>
                                        <span className="text-xs text-zinc-400 font-medium truncate max-w-[80px]">{artist.name}</span>
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Recommended For You */}
                {recommended.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                    >
                        <h3 className="text-lg font-bold tracking-wide text-white font-['Outfit'] mb-4 flex items-center gap-2">
                            <Sparkles size={18} className="text-accent" />
                            Recommended <span className="text-accent">For You</span>
                        </h3>
                        <div className="overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                            <div className="flex gap-4 w-max">
                                {recommended.map((rec, i) => {
                                    const song = librarySongs[rec.songId];
                                    if (!song) return null;
                                    return (
                                        <motion.div
                                            key={rec.songId}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.08 * i + 0.6 }}
                                            className="w-40 shrink-0 group cursor-pointer"
                                            onClick={() => {
                                                const allIds = Object.keys(librarySongs);
                                                usePlayerStore.getState().playSong(rec.songId, allIds);
                                            }}
                                        >
                                            <div className="relative w-40 h-40 rounded-2xl overflow-hidden mb-2 shadow-lg">
                                                {song.thumbnail ? (
                                                    <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                ) : (
                                                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                                        <Sparkles size={20} className="text-accent/40" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                                                <span className="absolute bottom-2 left-2 text-[9px] text-accent/70 bg-black/40 px-1.5 py-0.5 rounded-md font-medium">
                                                    {rec.reason}
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-semibold text-zinc-200 truncate group-hover:text-accent transition-colors">{song.title}</h4>
                                            <p className="text-xs text-zinc-600 truncate mt-0.5">{song.artist || 'Unknown'}</p>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Quick Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="grid grid-cols-2 gap-3"
                >
                    {[
                        { label: 'Your Library', to: '/library', color: 'from-accent/10 to-transparent' },
                        { label: 'Import Music', to: '/import', color: 'from-white/5 to-transparent' },
                        { label: 'Playlists', to: '/playlists', color: 'from-white/5 to-transparent' },
                        { label: 'Search', to: '/search', color: 'from-accent/10 to-transparent' },
                    ].map(action => (
                        <button
                            key={action.label}
                            onClick={() => navigate(action.to)}
                            className={`flex items-center justify-between px-4 py-4 rounded-2xl bg-linear-to-r ${action.color} border border-white/5 hover:border-white/10 transition-all group`}
                        >
                            <span className="text-sm font-semibold text-zinc-300 group-hover:text-white transition-colors">{action.label}</span>
                            <ChevronRight size={16} className="text-zinc-600 group-hover:text-accent transition-colors" />
                        </button>
                    ))}
                </motion.div>

                {/* Floating Pets */}
                {showPets && isPlaying && (
                    <>
                        <SlimePet analyzer={globalAnalyzer} isPlaying={isPlaying} />
                        <MiniRobo analyzer={globalAnalyzer} isPlaying={isPlaying} />
                    </>
                )}
            </div>
        </PageTransition>
    );
};

export default Home;
