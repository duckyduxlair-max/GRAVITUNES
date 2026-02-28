/**
 * GraviTunes Lyrics Service
 * Fetches lyrics from lrclib.net (free, no API key needed).
 * Supports both synced (LRC) and plain text lyrics.
 */

export interface SyncedLine {
    time: number; // seconds
    text: string;
}

export interface LyricsResult {
    synced: SyncedLine[] | null;  // Time-synced lines (LRC format)
    plain: string | null;         // Plain text fallback
    source: string;
}

const cache = new Map<string, LyricsResult>();

/**
 * Parse LRC format into timed lines.
 * Format: [mm:ss.xx] lyrics text
 */
function parseLRC(lrc: string): SyncedLine[] {
    const lines: SyncedLine[] = [];
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/g;
    let match;

    while ((match = regex.exec(lrc)) !== null) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const ms = parseInt(match[3].padEnd(3, '0'), 10);
        const text = match[4].trim();
        if (text) {
            lines.push({ time: minutes * 60 + seconds + ms / 1000, text });
        }
    }

    return lines.sort((a, b) => a.time - b.time);
}

/**
 * Fetch lyrics for a song by title and artist.
 */
export async function fetchLyrics(title: string, artist?: string): Promise<LyricsResult> {
    // Clean up title — remove common YouTube suffixes
    const cleanTitle = title
        .replace(/\s*\(official\s*(music\s*)?video\)/i, '')
        .replace(/\s*\[official\s*(music\s*)?video\]/i, '')
        .replace(/\s*\(lyrics?\)/i, '')
        .replace(/\s*\[lyrics?\]/i, '')
        .replace(/\s*\(audio\)/i, '')
        .replace(/\s*\[audio\]/i, '')
        .replace(/\s*\(visuali[sz]er\)/i, '')
        .replace(/\s*ft\.?\s*.*/i, '') // Remove "ft. Artist"
        .trim();

    const cacheKey = `${cleanTitle}|${artist || ''}`.toLowerCase();
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey)!;
    }

    const empty: LyricsResult = { synced: null, plain: null, source: 'none' };

    try {
        // Try search endpoint
        const params = new URLSearchParams({
            track_name: cleanTitle,
            ...(artist ? { artist_name: artist } : {}),
        });

        const res = await fetch(`https://lrclib.net/api/search?${params}`, {
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) {
            cache.set(cacheKey, empty);
            return empty;
        }

        const results = await res.json();
        if (!results || results.length === 0) {
            cache.set(cacheKey, empty);
            return empty;
        }

        // Pick best match (first result with synced lyrics preferred)
        const bestSynced = results.find((r: any) => r.syncedLyrics);
        const bestPlain = results.find((r: any) => r.plainLyrics);
        const best = bestSynced || bestPlain || results[0];

        const result: LyricsResult = {
            synced: best.syncedLyrics ? parseLRC(best.syncedLyrics) : null,
            plain: best.plainLyrics || null,
            source: 'lrclib.net',
        };

        cache.set(cacheKey, result);
        return result;
    } catch (err) {
        console.warn('[Lyrics] Fetch failed:', err);
        cache.set(cacheKey, empty);
        return empty;
    }
}

/**
 * Get the current active line index based on playback time.
 */
export function getActiveLine(lines: SyncedLine[], currentTime: number): number {
    for (let i = lines.length - 1; i >= 0; i--) {
        if (currentTime >= lines[i].time) return i;
    }
    return -1;
}
