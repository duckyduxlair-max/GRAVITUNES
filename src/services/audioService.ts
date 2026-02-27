import { saveAudioBlob, getAudioBlob } from './db';
import { useLibraryStore } from '../store/libraryStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
    try {
        // Validate URL
        try {
            new URL(url);
        } catch {
            return { success: false, error: 'Invalid URL format' };
        }

        // Fetching the blob
        const response = await fetch(url);

        if (!response.ok) {
            return { success: false, error: `Failed to fetch: ${response.statusText}` };
        }

        const contentLength = response.headers.get('content-length');
        const contentType = response.headers.get('content-type') || 'audio/mpeg';

        if (!contentType.includes('audio') && !contentType.includes('video/mp4') && !url.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
            return { success: false, error: 'URL does not point to a valid audio file' };
        }

        const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
        let receivedBytes = 0;

        const reader = response.body?.getReader();
        if (!reader) {
            return { success: false, error: 'ReadableStream not supported' };
        }

        const chunks: Uint8Array[] = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (value) {
                chunks.push(value);
                receivedBytes += value.length;
                if (totalBytes > 0) {
                    onProgress(Math.round((receivedBytes / totalBytes) * 100));
                } else {
                    // Indeterminate progress
                    onProgress(-1);
                }
            }
        }

        const blob = new Blob(chunks as BlobPart[], { type: contentType });

        // Save to IndexedDB
        await saveAudioBlob(url, blob);

        // Try to read duration (Hack: create object URL and read via HTMLAudioElement)
        const objectUrl = URL.createObjectURL(blob);
        const duration = await getAudioDuration(objectUrl);
        URL.revokeObjectURL(objectUrl); // Clean up

        const titleFromUrl = url.split('/').pop()?.split('?')[0] || 'Unknown Track';
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

        return { success: true };

    } catch (err: any) {
        console.error("Import error:", err);
        return { success: false, error: err.message || 'An unexpected error occurred during import. (Check CORS policies)' };
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
    try {
        onProgress(10, 'Extracting audio from YouTube...');

        // Use the configured API URL
        const res = await fetch(`${API_BASE_URL}/extract`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: videoUrl }),
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            return { success: false, error: (errorData as any).error || `Server error: ${res.status}` };
        }

        // Read title and duration from custom headers
        const titleHeader = res.headers.get('X-Title');
        const title = titleHeader ? decodeURIComponent(titleHeader) : 'Unknown Track';
        const duration = res.headers.get('X-Duration') || '0:00';
        const contentLength = parseInt(res.headers.get('Content-Length') || '0', 10);

        // Stream the response body with progress
        const reader = res.body?.getReader();
        if (!reader) {
            return { success: false, error: 'ReadableStream not supported' };
        }

        const chunks: Uint8Array[] = [];
        let receivedBytes = 0;
        let lastProgressPulse = Date.now();
        const totalBytes = contentLength; // Renaming for clarity with existing logic

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (value) {
                chunks.push(value);
                receivedBytes += value.length;
                if (totalBytes > 0) {
                    // Throttle progress updates a bit
                    const now = Date.now();
                    if (now - lastProgressPulse > 200) {
                        lastProgressPulse = now;
                        const percent = Math.min(10 + Math.round((receivedBytes / totalBytes) * 85), 95);
                        onProgress(percent, 'Downloading audio...');
                    }
                } else {
                    onProgress(-1, 'Downloading audio...'); // Indeterminate
                }
            }
        }

        onProgress(98, 'Finalizing audio...');

        const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });

        // Use a unique ID based on the YouTube URL
        const songId = `yt_${videoUrl}`;

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
            duration: parseFloat(duration) || 0, // Ensure duration is a number for the store
            size: receivedBytes,
            dateAdded: Date.now(),
            playCount: 0,
            thumbnail: offlineThumbnail,
            artist: metadata?.artist
        });

        onProgress(100, 'Download complete!');
        return { success: true };

    } catch (err: any) {
        console.error('YouTube import error:', err);
        return { success: false, error: err.message || 'Failed to extract audio from YouTube.' };
    }
};

