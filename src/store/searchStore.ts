import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SearchEntry {
    query: string;
    timestamp: number;
}

interface SearchState {
    history: SearchEntry[];
    queryCounts: Record<string, number>;
    addSearch: (query: string) => void;
    clearHistory: () => void;
    getTopQueries: (limit?: number) => string[];
}

const MAX_HISTORY = 200;

export const useSearchStore = create<SearchState>()(
    persist(
        (set, get) => ({
            history: [],
            queryCounts: {},

            addSearch: (query) => {
                const normalized = query.trim().toLowerCase();
                if (!normalized) return;

                set((state) => {
                    const newHistory = [
                        { query: normalized, timestamp: Date.now() },
                        ...state.history.slice(0, MAX_HISTORY - 1),
                    ];
                    const newCounts = { ...state.queryCounts };
                    newCounts[normalized] = (newCounts[normalized] || 0) + 1;
                    return { history: newHistory, queryCounts: newCounts };
                });
            },

            clearHistory: () => set({ history: [], queryCounts: {} }),

            getTopQueries: (limit = 10) => {
                const counts = get().queryCounts;
                return Object.entries(counts)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, limit)
                    .map(([q]) => q);
            },
        }),
        {
            name: 'anti-gravity-search-history',
        }
    )
);
