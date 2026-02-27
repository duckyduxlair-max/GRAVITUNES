import { useLibraryStore } from '../store/libraryStore';
import { useSearchStore } from '../store/searchStore';

/**
 * GraviTunes Recommendation Engine
 * Rule-based scoring using: play count, search history, time-of-day.
 * Returns ranked song IDs from library + suggested search queries.
 */

const TIME_WEIGHTS: Record<string, string[]> = {
    morning: ['chill', 'acoustic', 'soft', 'morning', 'ambient', 'lo-fi', 'coffee'],
    afternoon: ['pop', 'upbeat', 'dance', 'energy', 'workout', 'hip hop'],
    evening: ['jazz', 'soul', 'romantic', 'classical', 'r&b', 'smooth'],
    night: ['lo-fi', 'relaxing', 'sleep', 'ambient', 'calm', 'piano', 'acoustic'],
};

function getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
}

// Default trending queries for cold-start fallback
const DEFAULT_TRENDING = [
    'trending songs 2025', 'top hits', 'chill vibes', 'bollywood hits',
    'lo-fi beats', 'hip hop', 'pop music', 'romantic songs',
    'workout music', 'jazz classics',
];

export interface Recommendation {
    songId: string;
    score: number;
    reason: string;
}

export function getRecommendedSongs(limit = 10): Recommendation[] {
    const { songs } = useLibraryStore.getState();
    const songList = Object.values(songs);
    const { queryCounts } = useSearchStore.getState();
    const timeOfDay = getTimeOfDay();
    const timeKeywords = TIME_WEIGHTS[timeOfDay] || [];

    if (songList.length === 0) return [];

    const scored: Recommendation[] = songList.map(song => {
        let score = 0;
        let reason = '';

        // Play count factor (0-40 points)
        const playScore = Math.min((song.playCount || 0) * 5, 40);
        score += playScore;
        if (playScore > 20) reason = 'Frequently played';

        // Search relevance (0-30 points)
        const titleLower = song.title.toLowerCase();
        const artistLower = (song.artist || '').toLowerCase();

        for (const [query, count] of Object.entries(queryCounts)) {
            if (titleLower.includes(query) || artistLower.includes(query)) {
                const searchScore = Math.min(count * 3, 30);
                score += searchScore;
                if (searchScore > 10) reason = reason || 'Matches your searches';
            }
        }

        // Time-of-day relevance (0-20 points)
        for (const keyword of timeKeywords) {
            if (titleLower.includes(keyword) || artistLower.includes(keyword)) {
                score += 20;
                reason = reason || `Great for ${timeOfDay}`;
                break;
            }
        }

        // Recency bonus (0-10 points) — recently added songs get a boost
        const ageHours = (Date.now() - song.dateAdded) / (1000 * 60 * 60);
        if (ageHours < 24) score += 10;
        else if (ageHours < 72) score += 5;

        if (!reason) reason = 'From your library';

        return { songId: song.id, score, reason };
    });

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

export function getSuggestedSearches(limit = 6): string[] {
    const topQueries = useSearchStore.getState().getTopQueries(limit);

    // Cold start fallback
    if (topQueries.length < 3) {
        const timeOfDay = getTimeOfDay();
        const timeKeywords = TIME_WEIGHTS[timeOfDay] || [];
        const fallback = [
            ...timeKeywords.slice(0, 2).map(k => `${k} music`),
            ...DEFAULT_TRENDING.slice(0, limit - topQueries.length),
        ];
        return [...topQueries, ...fallback].slice(0, limit);
    }

    return topQueries;
}
