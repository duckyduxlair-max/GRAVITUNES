import { saveAudioBlob, getAudioBlob, deleteAudioBlob } from './db';
import { useLibraryStore } from '../store/libraryStore';
import { useDownloadStore } from '../store/downloadStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ─── Download Cancellation Registry ───
const activeControllers = new Map<string, AbortController>();

export function cancelDownload(dlId: string) {
    const ctrl = activeControllers.get(dlId);
    if (ctrl) {
        ctrl.abort();
        activeControllers.delete(dlId);
    }
    useDownloadStore.getState().updateDownload(dlId, { status: 'cancelled' });
}

/**
 * Download a song from IndexedDB to the user's device as an MP3 file.
 */
export const downloadSongToDevice = async (songId: string, title: string): Promise<boolean> => {
    try {
        const blob = await getAudioBlob(songId);
        if (!blob) return false;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[<>:"/\\|?*]/g, '')}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    } catch (err) {
        console.error('Download error:', err);
        return false;
    }
};

export const importAudioFromUrl = async (
    url: string,
    onProgress: (progress: number) => void
): Promise<{ success: boolean; error?: string }> => {
    const dlId = `dl_url_${Date.now()}`;
    const abortCtrl = new AbortController();
    activeControllers.set(dlId, abortCtrl);
    const titleFromUrl = url.split('/').pop()?.split('?')[0] || 'Unknown Track';
    useDownloadStore.getState().addDownload({
        id: dlId,
        songId: url,
        title: decodeURIComponent(titleFromUrl).replace(/\.[^/.]+$/, ''),
        status: 'downloading',
        progress: 0,
        speed: '...',
        size: 0,
    });
    try {
        // Validate URL
        try {
            new URL(url);
        } catch {
            activeControllers.delete(dlId);
            useDownloadStore.getState().updateDownload(dlId, { status: 'failed' });
            return { success: false, error: 'Invalid URL format' };
        }

        // Fetching the blob
        const response = await fetch(url, { signal: abortCtrl.signal });

        if (!response.ok) {
            useDownloadStore.getState().updateDownload(dlId, { status: 'failed' });
            return { success: false, error: `Failed to fetch: ${response.statusText}` };
        }

        const contentLength = response.headers.get('content-length');
        const contentType = response.headers.get('content-type') || 'audio/mpeg';

        if (!contentType.includes('audio') && !contentType.includes('video/mp4') && !url.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
            useDownloadStore.getState().updateDownload(dlId, { status: 'failed' });
            return { success: false, error: 'URL does not point to a valid audio file' };
        }

        const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
        let receivedBytes = 0;
        const startTime = Date.now();

        const reader = response.body?.getReader();
        if (!reader) {
            useDownloadStore.getState().updateDownload(dlId, { status: 'failed' });
            return { success: false, error: 'ReadableStream not supported' };
        }

        const chunks: Uint8Array[] = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (value) {
                chunks.push(value);
                receivedBytes += value.length;
                const elapsed = (Date.now() - startTime) / 1000;
                const speed = elapsed > 0 ? `${(receivedBytes / 1024 / elapsed).toFixed(0)} KB/s` : '...';
                if (totalBytes > 0) {
                    const progress = Math.round((receivedBytes / totalBytes) * 100);
                    onProgress(progress);
                    useDownloadStore.getState().updateDownload(dlId, { progress, speed, size: receivedBytes });
                } else {
                    onProgress(-1);
                    useDownloadStore.getState().updateDownload(dlId, { speed, size: receivedBytes });
                }
            }
        }

        const blob = new Blob(chunks as BlobPart[], { type: contentType });

        // Save to IndexedDB
        await saveAudioBlob(url, blob);

        // Try to read duration
        const objectUrl = URL.createObjectURL(blob);
        const duration = await getAudioDuration(objectUrl);
        URL.revokeObjectURL(objectUrl);

        let cleanTitle = decodeURIComponent(titleFromUrl).replace(/\.[^/.]+$/, "");

        // Save to Library Store
        useLibraryStore.getState().addSong({
            id: url,
            title: cleanTitle,
            originalUrl: url,
            duration: duration || 0,
            size: receivedBytes,
            dateAdded: Date.now(),
            playCount: 0
        });

        activeControllers.delete(dlId);
        useDownloadStore.getState().updateDownload(dlId, { status: 'completed', progress: 100 });
        return { success: true };

    } catch (err: any) {
        activeControllers.delete(dlId);
        console.error("Import error:", err);
        const cancelled = err.name === 'AbortError';
        useDownloadStore.getState().updateDownload(dlId, { status: cancelled ? 'cancelled' : 'failed' });
        return { success: false, error: cancelled ? 'Download cancelled' : (err.message || 'An unexpected error occurred during import.') };
    }
};

export const getAudioDuration = (url: string): Promise<number> => {
    return new Promise((resolve) => {
        const audio = new Audio(url);
        audio.addEventListener('loadedmetadata', () => {
            resolve(audio.duration);
        });
        audio.addEventListener('error', () => {
            resolve(0); // fallback
        });
    });
};

/**
 * Import audio from a YouTube URL via the backend extraction API.
 */
export const importFromYouTube = async (
    videoUrl: string,
    onProgress: (progress: number, step: string) => void,
    metadata?: { thumbnail?: string; artist?: string }
): Promise<{ success: boolean; error?: string; metadata?: any }> => {
    const dlId = `dl_yt_${Date.now()}`;
    const songId = `yt_${videoUrl}`;
    const abortCtrl = new AbortController();
    activeControllers.set(dlId, abortCtrl);
    useDownloadStore.getState().addDownload({
        id: dlId,
        songId,
        title: 'YouTube Import...',
        status: 'downloading',
        progress: 0,
        speed: '...',
        size: 0,
    });
    try {
        onProgress(10, 'Extracting audio from YouTube...');

        // Use the configured API URL
        const res = await fetch(`${API_BASE_URL}/extract`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: videoUrl }),
            signal: abortCtrl.signal,
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            useDownloadStore.getState().updateDownload(dlId, { status: 'failed' });
            return { success: false, error: (errorData as any).error || `Server error: ${res.status}` };
        }

        // Read title and duration from custom headers
        const titleHeader = res.headers.get('X-Title');
        const title = titleHeader ? decodeURIComponent(titleHeader) : 'Unknown Track';
        const duration = res.headers.get('X-Duration') || '0:00';
        const contentLength = parseInt(res.headers.get('Content-Length') || '0', 10);

        // Update download title now that we know it
        useDownloadStore.getState().updateDownload(dlId, { title });

        // Stream the response body with progress
        const reader = res.body?.getReader();
        if (!reader) {
            useDownloadStore.getState().updateDownload(dlId, { status: 'failed' });
            return { success: false, error: 'ReadableStream not supported' };
        }

        const chunks: Uint8Array[] = [];
        let receivedBytes = 0;
        let lastProgressPulse = Date.now();
        const totalBytes = contentLength;
        const startTime = Date.now();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (value) {
                chunks.push(value);
                receivedBytes += value.length;
                const elapsed = (Date.now() - startTime) / 1000;
                const speed = elapsed > 0 ? `${(receivedBytes / 1024 / elapsed).toFixed(0)} KB/s` : '...';
                if (totalBytes > 0) {
                    const now = Date.now();
                    if (now - lastProgressPulse > 200) {
                        lastProgressPulse = now;
                        const percent = Math.min(10 + Math.round((receivedBytes / totalBytes) * 85), 95);
                        onProgress(percent, 'Downloading audio...');
                        useDownloadStore.getState().updateDownload(dlId, { progress: percent, speed, size: receivedBytes });
                    }
                } else {
                    onProgress(-1, 'Downloading audio...');
                    useDownloadStore.getState().updateDownload(dlId, { speed, size: receivedBytes });
                }
            }
        }

        onProgress(98, 'Finalizing audio...');

        const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });

        // Save to IndexedDB
        await saveAudioBlob(songId, blob);

        // Fetch Thumbnail as Base64 for offline cache
        let offlineThumbnail = metadata?.thumbnail;
        if (offlineThumbnail && offlineThumbnail.startsWith('http')) {
            try {
                const proxyUrl = `${API_BASE_URL}/proxy-image?url=${encodeURIComponent(offlineThumbnail)}`;
                const imgRes = await fetch(proxyUrl);
                if (imgRes.ok) {
                    const imgBlob = await imgRes.blob();
                    offlineThumbnail = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(imgBlob);
                    });
                }
            } catch (e) {
                console.warn('Failed to cache offline thumbnail', e);
            }
        }

        // Save to Library Store
        useLibraryStore.getState().addSong({
            id: songId,
            title: title,
            originalUrl: videoUrl,
            duration: parseFloat(duration) || 0,
            size: receivedBytes,
            dateAdded: Date.now(),
            playCount: 0,
            thumbnail: offlineThumbnail,
            artist: metadata?.artist
        });

        onProgress(100, 'Download complete!');
        activeControllers.delete(dlId);
        useDownloadStore.getState().updateDownload(dlId, { status: 'completed', progress: 100 });
        return { success: true };

    } catch (err: any) {
        activeControllers.delete(dlId);
        console.error('YouTube import error:', err);
        const cancelled = err.name === 'AbortError';
        useDownloadStore.getState().updateDownload(dlId, { status: cancelled ? 'cancelled' : 'failed' });
        if (cancelled) await deleteAudioBlob(songId).catch(() => { });
        return { success: false, error: cancelled ? 'Download cancelled' : (err.message || 'Failed to extract audio from YouTube.') };
    }
};

