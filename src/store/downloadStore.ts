import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DownloadRecord {
    id: string;
    songId: string;
    title: string;
    status: 'downloading' | 'completed' | 'cancelled' | 'failed';
    progress: number; // 0-100
    speed: string; // e.g. "1.2 MB/s"
    size: number;
    timestamp: number;
    error?: string;
}

interface DownloadState {
    downloads: DownloadRecord[];
    addDownload: (record: Omit<DownloadRecord, 'timestamp'>) => void;
    updateDownload: (id: string, updates: Partial<DownloadRecord>) => void;
    removeDownload: (id: string) => void;
    clearHistory: () => void;
}

export const useDownloadStore = create<DownloadState>()(
    persist(
        (set) => ({
            downloads: [],

            addDownload: (record) => set((state) => ({
                downloads: [
                    { ...record, timestamp: Date.now() },
                    ...state.downloads.slice(0, 99), // Keep max 100
                ],
            })),

            updateDownload: (id, updates) => set((state) => ({
                downloads: state.downloads.map(d =>
                    d.id === id ? { ...d, ...updates } : d
                ),
            })),

            removeDownload: (id) => set((state) => ({
                downloads: state.downloads.filter(d => d.id !== id),
            })),

            clearHistory: () => set((state) => ({
                downloads: state.downloads.filter(d => d.status === 'downloading'),
            })),
        }),
        {
            name: 'anti-gravity-downloads',
        }
    )
);
