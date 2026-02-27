import { useState, useRef, useEffect } from 'react';
import { Search as SearchIcon, Play, Pause, Heart, Loader2, Clock, ListPlus } from 'lucide-react';
import { importFromYouTube } from '../services/audioService';
import PageTransition from '../components/layout/PageTransition';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { useSearchParams } from 'react-router-dom';
import AddToPlaylistModal from '../components/common/AddToPlaylistModal';
import { useSearchStore } from '../store/searchStore';

interface SearchResult {
    id: string;
    title: string;
    artist: string;
    thumbnail: string;
    duration: string;
    url: string;
    views: number;
}

const GENRES = ['Pop', 'Hip Hop', 'R&B', 'Rock', 'Electronic', 'Jazz', 'Classical', 'Lo-fi'];

const Search = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [savingId, setSavingId] = useState<string | null>(null);
    const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
    const [playlistSongId, setPlaylistSongId] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [searchParams] = useSearchParams();

    const { currentStreamMetadata, isPlaying, setIsPlaying, playDirectStream } = usePlayerStore();
    const { songs, playlists, addSong, addSongToPlaylist, removeSongFromPlaylist } = useLibraryStore();
    const favoriteSongIds = playlists['favorites']?.songIds || [];

    // Auto-search if ?q= param exists (from Home artist click)
    useEffect(() => {
        const q = searchParams.get('q');
        if (q) {
            setQuery(q);
            handleSearch(undefined, q);
        }
    }, [searchParams]);

    const handleSearch = async (e?: React.FormEvent, overwriteQuery?: string) => {
        e?.preventDefault();
        const searchQuery = overwriteQuery ?? query;
        if (!searchQuery.trim()) return;

        setLoading(true);
        setError('');

        try {
            const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
            const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(searchQuery.trim())}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as any).error || `Search failed: ${res.status}`);
            }
            const data = await res.json();

            let newResults = data.results || [];
            const activeTrack = currentStreamMetadata ? results.find(r => r.id === currentStreamMetadata.id) : null;
            if (activeTrack && !newResults.some((r: SearchResult) => r.id === activeTrack.id)) {
                newResults = [activeTrack, ...newResults];
            }
            setResults(newResults);
            // Track search for recommendations
            useSearchStore.getState().addSearch(searchQuery);
        } catch (err: any) {
            setError(err.message || 'Search failed');
        } finally {
            setLoading(false);
        }
    };

    const handleStream = async (result: SearchResult) => {
        if (currentStreamMetadata?.id === result.id) {
            setIsPlaying(!isPlaying);
            return;
        }
        const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
        playDirectStream(`${API_BASE_URL}/stream?v=${result.id}`, {
            id: result.id,
            title: result.title,
            artist: result.artist,
            thumbnail: result.thumbnail
        });
    };

    const handleLike = (result: SearchResult) => {
        const songId = `yt_${result.url}`;
        const isCurrentlyLiked = favoriteSongIds.includes(songId) || likedIds.has(result.id);

        if (isCurrentlyLiked) {
            // Unlike: remove from favorites
            removeSongFromPlaylist('favorites', songId);
            setLikedIds(prev => { const next = new Set(prev); next.delete(result.id); return next; });
            return;
        }

        // INSTANT: Mark as liked visually
        setLikedIds(prev => new Set(prev).add(result.id));

        // INSTANT: Add metadata to library + favorites so heart fills immediately
        let finalThumbnail = result.thumbnail;
        if (finalThumbnail && finalThumbnail.startsWith('//')) {
            finalThumbnail = `https:${finalThumbnail}`;
        }


        if (!songs[songId]) {
            addSong({
                id: songId,
                title: result.title,
                originalUrl: result.url,
                duration: 0,
                size: 0,
                dateAdded: Date.now(),
                playCount: 0,
                thumbnail: finalThumbnail,
                artist: result.artist,
            });
        }
        addSongToPlaylist('favorites', songId);

        // BACKGROUND: Download audio asynchronously
        setSavingId(result.id);
        (async () => {
            try {
                const res = await importFromYouTube(result.url, () => { }, {
                    thumbnail: finalThumbnail,
                    artist: result.artist
                });
                if (!res.success) {
                    console.error('Background download failed:', res.error);
                }
            } catch (err) {
                console.error('Background download error:', err);
            } finally {
                setSavingId(null);
            }
        })();
    };

    const handleInputChange = (val: string) => {
        setQuery(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (val.trim().length >= 3) {
            debounceRef.current = setTimeout(() => {
                handleSearch(undefined, val);
            }, 800);
        }
    };

    return (
        <PageTransition>
            <div className="h-full flex flex-col relative max-w-4xl mx-auto">
                {/* Header */}
                <div className="shrink-0 pt-2 pb-6">
                    <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white/5 font-['Outfit'] leading-none select-none">
                        SEARCH
                    </h2>
                    <h3 className="text-lg font-bold tracking-wide text-white -mt-5 md:-mt-6 ml-1 font-['Outfit'] mb-5">
                        Find <span className="text-accent">Music</span>
                    </h3>

                    <form onSubmit={handleSearch} className="relative">
                        <SearchIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => handleInputChange(e.target.value)}
                            placeholder="Search songs, artists, albums…"
                            className="w-full glass-panel rounded-2xl pl-12 pr-28 py-4 text-sm text-white focus:outline-none focus:border-accent/30 transition-all placeholder:text-zinc-600"
                        />
                        <button
                            type="submit"
                            disabled={loading || !query.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-accent text-black font-bold text-xs tracking-widest rounded-xl hover:bg-accent/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed uppercase"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
                        </button>
                    </form>

                    {error && (
                        <p className="text-red-400 text-sm text-center mt-3">{error}</p>
                    )}
                </div>

                {/* Genre Pills (when no results) */}
                {results.length === 0 && !query.trim() && (
                    <div className="mb-6">
                        <h4 className="text-sm font-bold text-zinc-400 tracking-wide mb-3 uppercase">Browse Genres</h4>
                        <div className="flex flex-wrap gap-2">
                            {GENRES.map(genre => (
                                <button
                                    key={genre}
                                    onClick={() => { setQuery(genre); handleSearch(undefined, genre); }}
                                    className="px-4 py-2 rounded-xl glass-card text-sm font-medium text-zinc-300 hover:text-accent hover:border-accent/20 transition-all"
                                >
                                    {genre}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Results */}
                <div className="flex-1 overflow-y-auto pb-48">
                    {loading && results.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 opacity-50">
                            <Loader2 size={40} className="animate-spin text-accent mb-4" />
                            <span className="text-zinc-500 text-sm tracking-wide">Searching...</span>
                        </div>
                    )}

                    {!loading && results.length === 0 && query.trim() && (
                        <div className="text-center py-20 opacity-50">
                            <SearchIcon size={48} className="mx-auto text-zinc-700 mb-4" />
                            <p className="text-zinc-500 text-sm tracking-wide">No results found</p>
                        </div>
                    )}

                    <div className="grid gap-3 w-full">
                        {results.map((result) => {
                            const isThisStreaming = currentStreamMetadata?.id === result.id;
                            const songId = `yt_${result.url}`;
                            const isLiked = favoriteSongIds.includes(songId) || likedIds.has(result.id);
                            const isDownloading = savingId === result.id;

                            return (
                                <div
                                    key={result.id}
                                    onClick={() => handleStream(result)}
                                    className={`group flex items-center gap-3 p-2.5 rounded-2xl transition-all duration-300 border cursor-pointer
                                        ${isThisStreaming
                                            ? 'bg-accent/5 border-accent/20 shadow-[0_0_20px_rgba(var(--accent-rgb),0.08)]'
                                            : 'border-transparent hover:border-white/5 hover:bg-white/3'
                                        }`}
                                >
                                    {/* Thumbnail */}
                                    <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-xl overflow-hidden shrink-0 bg-zinc-900">
                                        <img
                                            src={result.thumbnail}
                                            alt={result.title}
                                            className={`w-full h-full object-cover transition-transform duration-500 ${isThisStreaming ? 'scale-110' : ''}`}
                                            loading="lazy"
                                        />
                                        {isThisStreaming && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                <div className="flex gap-0.5 items-end h-4">
                                                    <div className={`w-0.5 h-2 bg-accent rounded-full ${isPlaying ? 'animate-pulse' : ''}`} />
                                                    <div className={`w-0.5 h-4 bg-accent rounded-full ${isPlaying ? 'animate-pulse [animation-delay:100ms]' : ''}`} />
                                                    <div className={`w-0.5 h-1.5 bg-accent rounded-full ${isPlaying ? 'animate-pulse [animation-delay:200ms]' : ''}`} />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0 pr-2">
                                        <h3 className={`font-semibold text-sm line-clamp-2 transition-colors ${isThisStreaming ? 'text-accent' : 'text-zinc-200'}`}>
                                            {result.title}
                                        </h3>
                                        <p className="text-zinc-500 text-xs truncate mt-0.5">{result.artist}</p>
                                        <div className="flex items-center gap-2 mt-1 opacity-50">
                                            <Clock size={10} className="text-zinc-500" />
                                            <span className="text-zinc-500 text-[10px]">{result.duration}</span>
                                            <span className="text-zinc-600 text-[10px]">•</span>
                                            <span className="text-zinc-500 text-[10px]">{Intl.NumberFormat('en-US', { notation: "compact" }).format(result.views)} views</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-1.5 shrink-0">
                                        <button
                                            onClick={() => setPlaylistSongId(songId)}
                                            className="w-9 h-9 rounded-full flex items-center justify-center transition-all border bg-white/5 border-white/5 text-zinc-500 hover:text-accent hover:border-accent/30"
                                            title="Add to Playlist"
                                        >
                                            <ListPlus size={14} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleLike(result); }}
                                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border
                                                ${isLiked
                                                    ? 'bg-accent/15 border-accent/30 text-accent shadow-[0_0_12px_rgba(var(--accent-rgb),0.2)]'
                                                    : 'bg-white/5 border-white/5 text-zinc-500 hover:text-accent hover:border-accent/30'
                                                }`}
                                            title={isLiked ? 'Unlike' : 'Like & Download'}
                                        >
                                            {isDownloading
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : <Heart size={14} fill={isLiked ? 'currentColor' : 'transparent'} />
                                            }
                                        </button>

                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleStream(result); }}
                                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-lg
                                                ${isThisStreaming
                                                    ? 'bg-accent text-black scale-105'
                                                    : 'bg-white/10 text-white hover:bg-white/20 hover:scale-105'
                                                }`}
                                            title={isThisStreaming ? "Pause" : "Play stream"}
                                        >{isThisStreaming && isPlaying
                                            ? <Pause size={14} fill="currentColor" />
                                            : <Play size={14} fill="currentColor" className="ml-0.5" />
                                            }
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Playlist Modal */}
                {playlistSongId && (
                    <AddToPlaylistModal songId={playlistSongId} onClose={() => setPlaylistSongId(null)} />
                )}
            </div>
        </PageTransition>
    );
};

export default Search;
