/**
 * GraviTunes Lyrics Service
 * Fetches lyrics from lrclib.net (free, no API key needed).
 * Supports both synced (LRC) and plain text lyrics.
 * STRICT matching — never shows wrong lyrics.
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
const EMPTY: LyricsResult = { synced: null, plain: null, source: 'none' };

// ─── Offline Lyrics Storage (localStorage) ───
const LYRICS_STORAGE_KEY = 'gravitunes_offline_lyrics';

export function saveLyricsOffline(songId: string, lyrics: LyricsResult) {
    try {
        const store = JSON.parse(localStorage.getItem(LYRICS_STORAGE_KEY) || '{}');
        store[songId] = lyrics;
        localStorage.setItem(LYRICS_STORAGE_KEY, JSON.stringify(store));
    } catch { /* storage full, ignore */ }
}

export function getOfflineLyrics(songId: string): LyricsResult | null {
    try {
        const store = JSON.parse(localStorage.getItem(LYRICS_STORAGE_KEY) || '{}');
        return store[songId] || null;
    } catch { return null; }
}

export function deleteOfflineLyrics(songId: string) {
    try {
        const store = JSON.parse(localStorage.getItem(LYRICS_STORAGE_KEY) || '{}');
        delete store[songId];
        localStorage.setItem(LYRICS_STORAGE_KEY, JSON.stringify(store));
    } catch { /* ignore */ }
}

export function isLyricsDownloadEnabled(): boolean {
    return localStorage.getItem('gravitunes_lyrics_download') !== 'false';
}

export function setLyricsDownloadEnabled(enabled: boolean) {
    localStorage.setItem('gravitunes_lyrics_download', enabled ? 'true' : 'false');
}

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
 * Clean YouTube title for matching.
 */
function cleanTitle(title: string): string {
    return title
        .replace(/\s*\(official\s*(music\s*)?video\)/i, '')
        .replace(/\s*\[official\s*(music\s*)?video\]/i, '')
        .replace(/\s*\(lyrics?\)/i, '')
        .replace(/\s*\[lyrics?\]/i, '')
        .replace(/\s*\(audio\)/i, '')
        .replace(/\s*\[audio\]/i, '')
        .replace(/\s*\(visuali[sz]er\)/i, '')
        .replace(/\s*ft\.?\s*.*/i, '')
        .trim();
}

/**
 * Calculate how similar two strings are (0-1 scale).
 */
function similarity(a: string, b: string): number {
    const s1 = a.toLowerCase().trim();
    const s2 = b.toLowerCase().trim();
    if (s1 === s2) return 1;
    if (!s1 || !s2) return 0;

    // Simple word overlap scoring
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));
    let overlap = 0;
    for (const w of words1) {
        if (words2.has(w)) overlap++;
    }
    return (2 * overlap) / (words1.size + words2.size);
}

/**
 * Fetch lyrics for a song by title and artist.
 * STRICT: validates title similarity and duration tolerance (±5s).
 * If no confident match → returns empty (no fallback to wrong lyrics).
 */
export async function fetchLyrics(
    title: string,
    artist?: string,
    durationSeconds?: number
): Promise<LyricsResult> {
    const cleaned = cleanTitle(title);
    const cacheKey = `${cleaned}|${artist || ''}`.toLowerCase();

    if (cache.has(cacheKey)) {
        return cache.get(cacheKey)!;
    }

    try {
        const params = new URLSearchParams({
            track_name: cleaned,
            ...(artist && artist !== 'GraviTunes' ? { artist_name: artist } : {}),
        });

        const res = await fetch(`https://lrclib.net/api/search?${params}`, {
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) {
            cache.set(cacheKey, EMPTY);
            return EMPTY;
        }

        const results = await res.json();
        if (!results || results.length === 0) {
            cache.set(cacheKey, EMPTY);
            return EMPTY;
        }

        // ── STRICT MATCHING ──
        // Score each result by title similarity + duration tolerance
        let bestResult: any = null;
        let bestScore = 0;

        for (const r of results) {
            const titleScore = similarity(cleaned, r.trackName || '');

            // Duration check: reject if > ±5 seconds off
            let durationOk = true;
            if (durationSeconds && r.duration) {
                durationOk = Math.abs(durationSeconds - r.duration) <= 5;
            }
            if (!durationOk) continue;

            // Artist match bonus
            const artistScore = artist && r.artistName
                ? similarity(artist, r.artistName) * 0.3
                : 0;

            const totalScore = titleScore + artistScore;

            // Prefer synced lyrics
            const syncBonus = r.syncedLyrics ? 0.1 : 0;

            if (totalScore + syncBonus > bestScore) {
                bestScore = totalScore + syncBonus;
                bestResult = r;
            }
        }

        // Reject if title similarity is too low (< 0.4)
        if (!bestResult || bestScore < 0.4) {
            cache.set(cacheKey, EMPTY);
            return EMPTY;
        }

        const result: LyricsResult = {
            synced: bestResult.syncedLyrics ? parseLRC(bestResult.syncedLyrics) : null,
            plain: bestResult.plainLyrics || null,
            source: 'lrclib.net',
        };

        cache.set(cacheKey, result);
        return result;
    } catch (err) {
        console.warn('[Lyrics] Fetch failed:', err);
        cache.set(cacheKey, EMPTY);
        return EMPTY;
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
