/**
 * GraviTunes Lyrics Service
 * Primary: lrclib.net (synced lyrics)
 * Fallback: lyrics.ovh (plain lyrics, huge database)
 * STRICT matching — never shows wrong lyrics.
 */

export interface SyncedLine {
    time: number; // seconds
    text: string;
}

export interface LyricsResult {
    synced: SyncedLine[] | null;
    plain: string | null;
    source: string;
}

const cache = new Map<string, LyricsResult>();
const EMPTY: LyricsResult = { synced: null, plain: null, source: 'none' };

// ─── Offline Lyrics Storage ───
const LYRICS_STORAGE_KEY = 'gravitunes_offline_lyrics';

export function saveLyricsOffline(songId: string, lyrics: LyricsResult) {
    try {
        const store = JSON.parse(localStorage.getItem(LYRICS_STORAGE_KEY) || '{}');
        store[songId] = lyrics;
        localStorage.setItem(LYRICS_STORAGE_KEY, JSON.stringify(store));
    } catch { /* storage full */ }
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

// ─── LRC Parser ───
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

// ─── Title & Artist Extraction ───
function cleanTitle(title: string): { cleaned: string; extractedArtist: string | null } {
    let t = title;

    // Extract artist from "Artist - Title" format (very common in YouTube)
    let extractedArtist: string | null = null;
    const dashMatch = t.match(/^(.+?)\s*[-–—]\s*(.+)$/);
    if (dashMatch) {
        extractedArtist = dashMatch[1].trim();
        t = dashMatch[2].trim();
    }

    // Remove YouTube junk
    t = t
        .replace(/\s*\(official\s*(music\s*)?video\)/i, '')
        .replace(/\s*\[official\s*(music\s*)?video\]/i, '')
        .replace(/\s*\(official\s*audio\)/i, '')
        .replace(/\s*\[official\s*audio\]/i, '')
        .replace(/\s*\(lyrics?\s*(video)?\)/i, '')
        .replace(/\s*\[lyrics?\s*(video)?\]/i, '')
        .replace(/\s*\(audio\)/i, '')
        .replace(/\s*\[audio\]/i, '')
        .replace(/\s*\(visuali[sz]er\)/i, '')
        .replace(/\s*\[visuali[sz]er\]/i, '')
        .replace(/\s*\(HD\)/i, '')
        .replace(/\s*\[HD\]/i, '')
        .replace(/\s*\(HQ\)/i, '')
        .replace(/\s*\(4K\)/i, '')
        .replace(/\s*\(official\)/i, '')
        .replace(/\s*\[official\]/i, '')
        .replace(/\s*\(mv\)/i, '')
        .replace(/\s*\[mv\]/i, '')
        .replace(/\s*\(Full\s*Song\)/i, '')
        .replace(/\s*\(Full\s*Video\)/i, '')
        .replace(/\s*\|\s*.*/i, '') // Remove "|" and everything after
        .replace(/\s*ft\.?\s+.*/i, '') // Remove "ft. Artist"
        .replace(/\s*feat\.?\s+.*/i, '')
        .trim();

    return { cleaned: t, extractedArtist };
}

/**
 * Normalize string for comparison: lowercase, remove punctuation, collapse spaces.
 */
function normalize(s: string): string {
    return s.toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Check if a result's track name contains the search query (or vice versa).
 * More robust than word overlap.
 */
function isTitleMatch(search: string, result: string): boolean {
    const a = normalize(search);
    const b = normalize(result);
    if (!a || !b) return false;

    // Exact match
    if (a === b) return true;

    // One contains the other
    if (a.includes(b) || b.includes(a)) return true;

    // Check if all words of the shorter string appear in the longer
    const wordsA = a.split(' ');
    const wordsB = b.split(' ');
    const [shorter, longer] = wordsA.length <= wordsB.length
        ? [wordsA, new Set(wordsB)]
        : [wordsB, new Set(wordsA)];

    let matchCount = 0;
    for (const w of shorter) {
        if (longer.has(w)) matchCount++;
    }

    // At least 60% of words must match
    return matchCount / shorter.length >= 0.6;
}

// ─── Primary: lrclib.net ───
async function fetchFromLrclib(title: string, artist: string | undefined, duration?: number): Promise<LyricsResult> {
    try {
        const params = new URLSearchParams({ track_name: title });
        if (artist && artist !== 'GraviTunes' && artist !== 'Independent Artist') {
            params.set('artist_name', artist);
        }

        const res = await fetch(`https://lrclib.net/api/search?${params}`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return EMPTY;

        const results = await res.json();
        if (!results?.length) return EMPTY;

        // Find best VALID match
        for (const r of results) {
            // STRICT: title must match
            if (!isTitleMatch(title, r.trackName || '')) continue;

            // Duration check (±5 seconds)
            if (duration && r.duration && Math.abs(duration - r.duration) > 5) continue;

            // Found a valid match
            return {
                synced: r.syncedLyrics ? parseLRC(r.syncedLyrics) : null,
                plain: r.plainLyrics || null,
                source: 'lrclib.net',
            };
        }

        return EMPTY;
    } catch {
        return EMPTY;
    }
}

// ─── Fallback: lyrics.ovh (huge database, plain text only) ───
async function fetchFromLyricsOvh(title: string, artist: string): Promise<LyricsResult> {
    try {
        const res = await fetch(
            `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
            { signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) return EMPTY;

        const data = await res.json();
        if (!data?.lyrics || data.lyrics.trim().length < 20) return EMPTY;

        return {
            synced: null,
            plain: data.lyrics.trim(),
            source: 'lyrics.ovh',
        };
    } catch {
        return EMPTY;
    }
}

/**
 * Fetch lyrics — tries lrclib first, then lyrics.ovh fallback.
 * STRICT: never returns wrong lyrics.
 */
export async function fetchLyrics(
    title: string,
    artist?: string,
    durationSeconds?: number
): Promise<LyricsResult> {
    const { cleaned, extractedArtist } = cleanTitle(title);
    const effectiveArtist = artist || extractedArtist || undefined;
    const cacheKey = `${cleaned}|${effectiveArtist || ''}`.toLowerCase();

    if (cache.has(cacheKey)) {
        return cache.get(cacheKey)!;
    }

    // 1. Try lrclib.net (synced lyrics preferred)
    let result = await fetchFromLrclib(cleaned, effectiveArtist, durationSeconds);

    // 2. If no result and we have an artist, try lyrics.ovh
    if (result.source === 'none' && effectiveArtist) {
        result = await fetchFromLyricsOvh(cleaned, effectiveArtist);
    }

    // 3. If still no result, try with just the cleaned title and extracted artist
    if (result.source === 'none' && extractedArtist && extractedArtist !== effectiveArtist) {
        result = await fetchFromLyricsOvh(cleaned, extractedArtist);
    }

    cache.set(cacheKey, result);
    return result;
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
