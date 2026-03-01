import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useLibraryStore } from './libraryStore';

type RepeatMode = 'OFF' | 'ALL' | 'ONE';
type PlaybackSource = 'STREAM' | 'LIBRARY';

export interface StreamMetadata {
    title: string;
    artist: string;
    thumbnail: string;
    id: string;
}

interface PlayerState {
    currentSongId: string | null;
    queue: string[];
    currentIndex: number;

    isPlaying: boolean;
    volume: number; // 0 to 1
    repeatMode: RepeatMode;
    isShuffle: boolean;

    currentStreamUrl: string | null;
    currentStreamMetadata: StreamMetadata | null;

    // Dual Queue System
    streamQueue: StreamMetadata[];
    streamQueueIndex: number;
    playbackSource: PlaybackSource;
    lastStreamTrack: StreamMetadata | null;

    isExpanded: boolean;
    sleepTimer: number | null;
    isBuffering: boolean;

    // Actions
    playSong: (id: string, queue?: string[]) => void;
    playDirectStream: (url: string, metadata: StreamMetadata) => void;
    clearStream: () => void;
    playNext: () => void;
    playPrevious: () => void;

    setIsPlaying: (isPlaying: boolean) => void;
    setVolume: (volume: number) => void;
    toggleShuffle: () => void;
    toggleRepeat: () => void;
    setQueue: (queue: string[]) => void;
    clearQueue: () => void;
    setIsExpanded: (isExpanded: boolean) => void;
    setSleepTimer: (minutes: number | null) => void;
    setBuffering: (isBuffering: boolean) => void;
}

export const usePlayerStore = create<PlayerState>()(
    persist(
        (set) => ({
            currentSongId: null,
            queue: [],
            currentIndex: -1,

            isPlaying: false,
            volume: 1,
            repeatMode: 'OFF',
            isShuffle: false,

            currentStreamUrl: null,
            currentStreamMetadata: null,

            // Dual Queue
            streamQueue: [],
            streamQueueIndex: -1,
            playbackSource: 'LIBRARY',
            lastStreamTrack: null,

            isExpanded: false,
            sleepTimer: null,
            isBuffering: false,

            playSong: (id, newQueue) => set((state) => {
                const queue = newQueue || state.queue;
                const index = queue.indexOf(id);

                let finalQueue = [...queue];
                let finalIndex = index;

                if (index === -1) {
                    finalQueue = [id];
                    finalIndex = 0;
                }

                return {
                    currentSongId: id,
                    queue: finalQueue,
                    currentIndex: finalIndex,
                    isPlaying: true,
                    currentStreamUrl: null,
                    currentStreamMetadata: null,
                    playbackSource: 'LIBRARY' as PlaybackSource,
                };
            }),

            playDirectStream: (url, metadata) => set((state) => {
                // Add to stream queue for backward/forward navigation
                const existingIdx = state.streamQueue.findIndex(s => s.id === metadata.id);
                let newStreamQueue = [...state.streamQueue];
                let newStreamIndex: number;

                if (existingIdx >= 0) {
                    // Already in queue — just move index
                    newStreamIndex = existingIdx;
                } else {
                    // Append to stream queue
                    newStreamQueue.push(metadata);
                    newStreamIndex = newStreamQueue.length - 1;
                }

                return {
                    currentStreamUrl: url,
                    currentStreamMetadata: metadata,
                    isPlaying: true,
                    streamQueue: newStreamQueue,
                    streamQueueIndex: newStreamIndex,
                    playbackSource: 'STREAM' as PlaybackSource,
                    lastStreamTrack: metadata,
                };
            }),

            clearStream: () => set({
                currentStreamUrl: null,
                currentStreamMetadata: null,
                isPlaying: false,
            }),

            playNext: () => set((state) => {
                const { songs } = useLibraryStore.getState();
                const allSongIds = Object.keys(songs);

                // ── REPEAT ONE: replay current (works for both stream and library) ──
                if (state.repeatMode === 'ONE') {
                    return { isPlaying: true };
                }

                // ── CURRENTLY STREAMING ──
                if (state.currentStreamUrl || state.playbackSource === 'STREAM') {
                    // Check if there's a next song in stream queue
                    const nextStreamIdx = state.streamQueueIndex + 1;
                    if (nextStreamIdx < state.streamQueue.length) {
                        const nextStream = state.streamQueue[nextStreamIdx];
                        const API_BASE = import.meta.env?.VITE_API_URL || '/api';
                        return {
                            currentStreamUrl: `${API_BASE}/stream?v=${nextStream.id}`,
                            currentStreamMetadata: nextStream,
                            streamQueueIndex: nextStreamIdx,
                            lastStreamTrack: nextStream,
                            isPlaying: true,
                            playbackSource: 'STREAM' as PlaybackSource,
                        };
                    }

                    // REPEAT ALL for streams: loop back to first stream
                    if (state.repeatMode === 'ALL' && state.streamQueue.length > 0) {
                        const firstStream = state.streamQueue[0];
                        const API_BASE = import.meta.env?.VITE_API_URL || '/api';
                        return {
                            currentStreamUrl: `${API_BASE}/stream?v=${firstStream.id}`,
                            currentStreamMetadata: firstStream,
                            streamQueueIndex: 0,
                            lastStreamTrack: firstStream,
                            isPlaying: true,
                            playbackSource: 'STREAM' as PlaybackSource,
                        };
                    }

                    // Stream queue exhausted → FALLBACK to library with FULL queue
                    if (allSongIds.length > 0) {
                        const randomId = allSongIds[Math.floor(Math.random() * allSongIds.length)];
                        return {
                            currentStreamUrl: null,
                            currentStreamMetadata: null,
                            currentSongId: randomId,
                            queue: allSongIds,  // Always full library queue
                            currentIndex: allSongIds.indexOf(randomId),
                            isPlaying: true,
                            playbackSource: 'LIBRARY' as PlaybackSource,
                        };
                    }

                    // No library songs either — stop
                    return { isPlaying: false };
                }

                // ── LIBRARY QUEUE ──
                if (state.queue.length === 0) {
                    // Queue empty but library has songs — build queue from all songs
                    if (allSongIds.length > 0) {
                        const randomId = allSongIds[Math.floor(Math.random() * allSongIds.length)];
                        return {
                            queue: allSongIds,
                            currentIndex: allSongIds.indexOf(randomId),
                            currentSongId: randomId,
                            isPlaying: true,
                        };
                    }
                    return state;
                }

                let nextIndex = state.currentIndex + 1;

                if (state.isShuffle) {
                    // Pick random but avoid same song
                    do {
                        nextIndex = Math.floor(Math.random() * state.queue.length);
                    } while (nextIndex === state.currentIndex && state.queue.length > 1);
                } else if (nextIndex >= state.queue.length) {
                    if (state.repeatMode === 'ALL') {
                        nextIndex = 0;
                    } else {
                        // Endless play: wrap around with full library queue
                        if (allSongIds.length > 0) {
                            const randomId = allSongIds[Math.floor(Math.random() * allSongIds.length)];
                            return {
                                queue: allSongIds,  // Reset to full library queue
                                currentIndex: allSongIds.indexOf(randomId),
                                currentSongId: randomId,
                                isPlaying: true,
                            };
                        } else {
                            return { isPlaying: false, currentIndex: state.queue.length - 1 };
                        }
                    }
                }

                return {
                    currentIndex: nextIndex,
                    currentSongId: state.queue[nextIndex],
                    isPlaying: true,
                };
            }),

            playPrevious: () => set((state) => {
                // ── CURRENTLY IN LIBRARY, BUT LAST WAS STREAM → go back to stream ──
                if (state.playbackSource === 'LIBRARY' && state.lastStreamTrack && state.streamQueue.length > 0) {
                    // Check if we just fell back from stream — restore last stream position
                    const lastIdx = state.streamQueueIndex;
                    if (lastIdx >= 0 && lastIdx < state.streamQueue.length) {
                        const track = state.streamQueue[lastIdx];
                        const API_BASE = import.meta.env?.VITE_API_URL || '/api';
                        return {
                            currentStreamUrl: `${API_BASE}/stream?v=${track.id}`,
                            currentStreamMetadata: track,
                            currentSongId: null,
                            isPlaying: true,
                            playbackSource: 'STREAM' as PlaybackSource,
                        };
                    }
                }

                // ── CURRENTLY STREAMING → go back in stream queue ──
                if (state.currentStreamUrl || state.playbackSource === 'STREAM') {
                    const prevStreamIdx = state.streamQueueIndex - 1;
                    if (prevStreamIdx >= 0) {
                        const prevStream = state.streamQueue[prevStreamIdx];
                        const API_BASE = import.meta.env?.VITE_API_URL || '/api';
                        return {
                            currentStreamUrl: `${API_BASE}/stream?v=${prevStream.id}`,
                            currentStreamMetadata: prevStream,
                            streamQueueIndex: prevStreamIdx,
                            lastStreamTrack: prevStream,
                            isPlaying: true,
                            playbackSource: 'STREAM' as PlaybackSource,
                        };
                    }
                    // At start of stream queue — wrap to end
                    if (state.streamQueue.length > 0) {
                        const lastStream = state.streamQueue[state.streamQueue.length - 1];
                        const API_BASE = import.meta.env?.VITE_API_URL || '/api';
                        return {
                            currentStreamUrl: `${API_BASE}/stream?v=${lastStream.id}`,
                            currentStreamMetadata: lastStream,
                            streamQueueIndex: state.streamQueue.length - 1,
                            lastStreamTrack: lastStream,
                            isPlaying: true,
                            playbackSource: 'STREAM' as PlaybackSource,
                        };
                    }
                    return { isPlaying: false };
                }

                // ── LIBRARY QUEUE ──
                if (state.queue.length === 0) return state;

                let prevIndex = state.currentIndex - 1;
                if (prevIndex < 0) {
                    prevIndex = state.queue.length - 1;
                }

                return {
                    currentIndex: prevIndex,
                    currentSongId: state.queue[prevIndex],
                    isPlaying: true,
                };
            }),

            setIsPlaying: (isPlaying) => set({ isPlaying }),
            setVolume: (volume) => set({ volume }),

            toggleShuffle: () => set((state) => ({ isShuffle: !state.isShuffle })),

            toggleRepeat: () => set((state) => {
                const nextMode = state.repeatMode === 'OFF' ? 'ALL' : state.repeatMode === 'ALL' ? 'ONE' : 'OFF';
                return { repeatMode: nextMode };
            }),

            setQueue: (queue) => set({ queue }),
            clearQueue: () => set({ queue: [], currentSongId: null, currentIndex: -1, isPlaying: false }),

            setIsExpanded: (isExpanded) => set({ isExpanded }),
            setSleepTimer: (sleepTimer) => set({ sleepTimer }),
            setBuffering: (isBuffering) => set({ isBuffering }),
        }),
        {
            name: 'anti-gravity-player-storage',
            partialize: (state) => ({
                volume: state.volume,
                repeatMode: state.repeatMode,
                isShuffle: state.isShuffle,
            }),
        }
    )
);
