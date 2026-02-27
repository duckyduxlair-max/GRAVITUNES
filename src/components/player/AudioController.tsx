import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { useLibraryStore } from '../../store/libraryStore';
import { getAudioBlob, pruneUnusedAudio } from '../../services/db';
import { eventBus, Events } from '../../services/eventBus';

export let globalAnalyzer: AnalyserNode | null = null;
export const globalAudio = new Audio();
globalAudio.crossOrigin = 'anonymous';
globalAudio.preload = 'auto';

// ── Dominant color extraction from thumbnail ──
const extractDominantColor = (imageUrl: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 16;
                canvas.height = 16;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(''); return; }
                ctx.drawImage(img, 0, 0, 16, 16);
                const data = ctx.getImageData(0, 0, 16, 16).data;
                let r = 0, g = 0, b = 0, count = 0;
                for (let i = 0; i < data.length; i += 4) {
                    // Skip very dark/light pixels
                    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    if (brightness > 30 && brightness < 220) {
                        r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
                    }
                }
                if (count > 0) {
                    resolve(`rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`);
                } else {
                    resolve('');
                }
            } catch { resolve(''); }
        };
        img.onerror = () => resolve('');
        // Use proxy for external images
        if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
            img.src = imageUrl;
        } else {
            const API_BASE = import.meta.env.VITE_API_URL || '/api';
            img.src = `${API_BASE}/proxy-image?url=${encodeURIComponent(imageUrl)}`;
        }
    });
};

// ── Update Media Session (notifications) ──
const updateMediaSession = async (title: string, artist: string, thumbnail?: string) => {
    if (!('mediaSession' in navigator)) return;

    const artworks: MediaImage[] = [];
    if (thumbnail) {
        artworks.push(
            { src: thumbnail, sizes: '96x96', type: 'image/jpeg' },
            { src: thumbnail, sizes: '256x256', type: 'image/jpeg' },
            { src: thumbnail, sizes: '512x512', type: 'image/jpeg' }
        );
    }

    navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: artist || 'GraviTunes',
        album: 'GraviTunes',
        artwork: artworks,
    });

    // Set action handlers
    navigator.mediaSession.setActionHandler('play', () => {
        usePlayerStore.getState().setIsPlaying(true);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
        usePlayerStore.getState().setIsPlaying(false);
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
        usePlayerStore.getState().playNext();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
        usePlayerStore.getState().playPrevious();
    });

    // Update theme-color with dominant color from artwork
    if (thumbnail) {
        const color = await extractDominantColor(thumbnail);
        if (color) {
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute('content', color);
        }
    }
};

const AudioController: React.FC = () => {
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const analyzerRef = useRef<AnalyserNode | null>(null);
    const bufferingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevBlobUrlRef = useRef<string | null>(null);

    const {
        currentSongId, currentStreamUrl, isPlaying, volume,
        setIsPlaying, setBuffering
    } = usePlayerStore() as any;

    const { updatePlayCount } = useLibraryStore();

    // ── Auto-prune temp audio on app start ──
    useEffect(() => {
        const { songs } = useLibraryStore.getState();
        const activeIds = Object.keys(songs);
        pruneUnusedAudio(activeIds).catch(console.error);
    }, []);

    // ── Setup Audio Context & Analyzer once on interaction ──
    useEffect(() => {
        const initAudioContext = () => {
            if (!audioContextRef.current) {
                try {
                    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                    audioContextRef.current = new AudioContext();
                    analyzerRef.current = audioContextRef.current.createAnalyser();
                    analyzerRef.current.fftSize = 512;
                    analyzerRef.current.smoothingTimeConstant = 0.8;
                    globalAnalyzer = analyzerRef.current;

                    sourceNodeRef.current = audioContextRef.current.createMediaElementSource(globalAudio);
                    sourceNodeRef.current.connect(analyzerRef.current);
                    analyzerRef.current.connect(audioContextRef.current.destination);

                    eventBus.emit(Events.ANALYZER_READY, analyzerRef.current);
                } catch (err) {
                    console.warn('Web Audio API initialization failed', err);
                }
            }
            if (audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume();
            }
        };

        const handlePlay = () => {
            initAudioContext();
        };

        // ── Buffering detection with 200ms debounce ──
        const handleWaiting = () => {
            if (bufferingTimerRef.current) clearTimeout(bufferingTimerRef.current);
            bufferingTimerRef.current = setTimeout(() => {
                setBuffering(true);
                eventBus.emit(Events.BUFFERING_CHANGE, true);
            }, 200); // Only show if waiting > 200ms
        };

        const handleCanPlay = () => {
            if (bufferingTimerRef.current) {
                clearTimeout(bufferingTimerRef.current);
                bufferingTimerRef.current = null;
            }
            setBuffering(false);
            eventBus.emit(Events.BUFFERING_CHANGE, false);
        };

        const handlePlaying = () => {
            if (bufferingTimerRef.current) {
                clearTimeout(bufferingTimerRef.current);
                bufferingTimerRef.current = null;
            }
            setBuffering(false);
        };

        globalAudio.addEventListener('play', handlePlay);
        globalAudio.addEventListener('waiting', handleWaiting);
        globalAudio.addEventListener('canplay', handleCanPlay);
        globalAudio.addEventListener('playing', handlePlaying);

        // ── Song ended handler — dual queue logic ──
        const onEnded = () => {
            const state = usePlayerStore.getState();

            // REPEAT ONE: replay current (stream or local)
            if (state.repeatMode === 'ONE') {
                globalAudio.currentTime = 0;
                globalAudio.play().catch(console.error);
                return;
            }

            // REPEAT ALL for streams: replay the same stream
            if (state.repeatMode === 'ALL' && state.currentStreamUrl) {
                globalAudio.currentTime = 0;
                globalAudio.play().catch(console.error);
                return;
            }

            // SHUFFLE for streams: pick random from library
            if (state.isShuffle && state.currentStreamUrl) {
                const { songs } = useLibraryStore.getState();
                const allIds = Object.keys(songs);
                if (allIds.length > 0) {
                    const randomId = allIds[Math.floor(Math.random() * allIds.length)];
                    usePlayerStore.getState().playSong(randomId, allIds);
                    return;
                }
            }

            // Emit stream ended event
            if (state.currentStreamUrl) {
                eventBus.emit(Events.STREAM_ENDED, state.currentStreamMetadata);
            }

            // Default: advance via dual-queue playNext
            state.playNext();
        };

        globalAudio.addEventListener('ended', onEnded);

        return () => {
            globalAudio.removeEventListener('play', handlePlay);
            globalAudio.removeEventListener('waiting', handleWaiting);
            globalAudio.removeEventListener('canplay', handleCanPlay);
            globalAudio.removeEventListener('playing', handlePlaying);
            globalAudio.removeEventListener('ended', onEnded);
            if (bufferingTimerRef.current) clearTimeout(bufferingTimerRef.current);
        };
    }, []);

    // ── Sync volume ──
    useEffect(() => {
        globalAudio.volume = volume;
    }, [volume]);

    // ── Sync playback state ──
    useEffect(() => {
        if (isPlaying) {
            const startPlay = () => {
                globalAudio.play().catch((err) => {
                    // Ignore NotSupportedError which happens when src is empty and loadAudio is still running
                    if (err.name !== 'NotSupportedError') {
                        setIsPlaying(false);
                    }
                });
            };

            if (audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume().then(startPlay);
            } else {
                startPlay();
            }
        } else {
            globalAudio.pause();
        }
        // Sync Media Session playback state
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        }
    }, [isPlaying, setIsPlaying]);

    // ── Track play counts ──
    const countedSongsRef = useRef<Set<string>>(new Set());

    // ── Source manager with null-state recovery ──
    useEffect(() => {
        const loadAudio = async () => {
            // Revoke previous blob URL to free memory
            if (prevBlobUrlRef.current) {
                URL.revokeObjectURL(prevBlobUrlRef.current);
                prevBlobUrlRef.current = null;
            }

            // Reset source before loading new
            globalAudio.src = '';

            if (currentStreamUrl) {
                globalAudio.src = currentStreamUrl;
                globalAudio.load();
                if (isPlaying) globalAudio.play().catch(console.error);

                // Update media session for streams
                const state = usePlayerStore.getState();
                const meta = state.currentStreamMetadata;
                if (meta) {
                    updateMediaSession(meta.title, meta.artist, meta.thumbnail);
                    eventBus.emit(Events.SONG_STARTED, { type: 'stream', metadata: meta });
                }
                return;
            }

            if (!currentSongId) {
                // ── NULL STATE FAIL-SAFE ──
                // If both are null and we were supposed to be playing, auto-recover
                const state = usePlayerStore.getState();
                if (state.isPlaying) {
                    const { songs } = useLibraryStore.getState();
                    const allIds = Object.keys(songs);
                    if (allIds.length > 0) {
                        const randomId = allIds[Math.floor(Math.random() * allIds.length)];
                        state.playSong(randomId, allIds);
                    } else {
                        setIsPlaying(false);
                    }
                }
                return;
            }

            // Try loading from IndexedDB (downloaded song)
            const blob = await getAudioBlob(currentSongId);
            if (blob) {
                const objectUrl = URL.createObjectURL(blob);
                prevBlobUrlRef.current = objectUrl;
                globalAudio.src = objectUrl;
                globalAudio.load();
                if (isPlaying) globalAudio.play().catch(console.error);

                // Increment play count
                if (!countedSongsRef.current.has(currentSongId)) {
                    countedSongsRef.current.add(currentSongId);
                    setTimeout(() => updatePlayCount(currentSongId), 1000);
                }

                // Update media session for library songs
                const song = useLibraryStore.getState().songs[currentSongId];
                if (song) {
                    updateMediaSession(song.title, song.artist || 'Unknown Artist', song.thumbnail);
                    eventBus.emit(Events.SONG_STARTED, { type: 'library', song });
                }
            } else {
                // Blob missing — try stream URL as fallback
                const song = useLibraryStore.getState().songs[currentSongId];
                if (song?.originalUrl) {
                    globalAudio.src = song.originalUrl;
                    globalAudio.load();
                    if (isPlaying) globalAudio.play().catch(console.error);
                    if (song) {
                        updateMediaSession(song.title, song.artist || 'Unknown Artist', song.thumbnail);
                    }
                } else {
                    setIsPlaying(false);
                }
            }
        };

        loadAudio();
    }, [currentSongId, currentStreamUrl]);

    return null; // Side-effect only component
};

export default AudioController;
