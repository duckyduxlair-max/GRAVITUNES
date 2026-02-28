import { useLibraryStore } from '../store/libraryStore';
import { importFromYouTube } from './audioService';
import { getAudioBlob } from './db';

/**
 * Background download for restored songs that have YouTube URLs but no local audio.
 */
async function autoDownloadRestoredSongs(songs: Record<string, any>) {
    for (const [id, song] of Object.entries(songs)) {
        if (!song.originalUrl) continue;
        const isYT = song.originalUrl.includes('youtube.com') || song.originalUrl.includes('youtu.be');
        if (!isYT) continue;

        // Skip if audio already exists in IndexedDB
        const existing = await getAudioBlob(id);
        if (existing) continue;

        try {
            console.log(`[Backup] Downloading: ${song.title}`);
            await importFromYouTube(song.originalUrl, () => { }, {
                thumbnail: song.thumbnail,
                artist: song.artist,
            });
        } catch (err) {
            console.warn(`[Backup] Failed to download ${song.title}:`, err);
        }
    }
}

const BACKUP_VERSION = '1.0';
const APP_VERSION = '2.1.0';

interface BackupData {
    backupVersion: string;
    appVersion: string;
    timestamp: number;
    songs: Record<string, any>;
    playlists: Record<string, any>;
}

/**
 * Export library metadata as a downloadable JSON file.
 * Does NOT include audio blobs — only metadata.
 */
export async function exportLibraryBackup(): Promise<void> {
    const { songs, playlists } = useLibraryStore.getState();

    const backup: BackupData = {
        backupVersion: BACKUP_VERSION,
        appVersion: APP_VERSION,
        timestamp: Date.now(),
        songs,
        playlists,
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `gravitunes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Import library backup from a JSON file.
 */
export async function importLibraryBackup(file: File): Promise<{
    success: boolean;
    imported: number;
    skipped: number;
    error?: string;
}> {
    try {
        const text = await file.text();
        const data: BackupData = JSON.parse(text);

        if (!data.backupVersion || !data.songs) {
            return { success: false, imported: 0, skipped: 0, error: 'Invalid backup file format.' };
        }

        const store = useLibraryStore.getState();
        let imported = 0;
        let skipped = 0;

        for (const [id, song] of Object.entries(data.songs)) {
            if (store.songs[id]) {
                skipped++;
                continue;
            }
            store.addSong({ ...song, id });
            imported++;
        }

        for (const [id, playlist] of Object.entries(data.playlists)) {
            if (!store.playlists[id]) {
                store.createPlaylist((playlist as any).name || id);
            }
            const pl = playlist as any;
            if (pl.songIds) {
                for (const songId of pl.songIds) {
                    store.addSongToPlaylist(id, songId);
                }
            }
        }

        // Auto-download audio for restored songs (background, sequential)
        if (imported > 0) {
            autoDownloadRestoredSongs(data.songs);
        }

        return { success: true, imported, skipped };
    } catch (err: any) {
        return {
            success: false,
            imported: 0,
            skipped: 0,
            error: err.message || 'Failed to parse backup file.',
        };
    }
}
