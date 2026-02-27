import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

export interface AudioFileData {
    id: string; // The song URL or unique ID
    blob: Blob; // The actual audio binary data
}

interface AntiGravityDB extends DBSchema {
    audio: {
        key: string;
        value: AudioFileData;
    };
}

const DB_NAME = 'AntiGravityMusicDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AntiGravityDB>> | null = null;

const initDB = async () => {
    if (!dbPromise) {
        dbPromise = openDB<AntiGravityDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('audio')) {
                    db.createObjectStore('audio', { keyPath: 'id' });
                }
            },
        });
    }
    return dbPromise;
};

export const saveAudioBlob = async (id: string, blob: Blob): Promise<void> => {
    const db = await initDB();
    await db.put('audio', { id, blob });
};

export const getAudioBlob = async (id: string): Promise<Blob | undefined> => {
    const db = await initDB();
    const data = await db.get('audio', id);
    return data?.blob;
};

export const deleteAudioBlob = async (id: string): Promise<void> => {
    const db = await initDB();
    await db.delete('audio', id);
};

export const clearAllAudio = async (): Promise<void> => {
    const db = await initDB();
    await db.clear('audio');
};

export const getStorageStats = async (): Promise<{ totalBytes: number; fileCount: number }> => {
    const db = await initDB();
    const allKeys = await db.getAllKeys('audio');
    let totalBytes = 0;
    for (const key of allKeys) {
        const entry = await db.get('audio', key);
        if (entry?.blob) {
            totalBytes += entry.blob.size;
        }
    }
    return { totalBytes, fileCount: allKeys.length };
};

export const pruneUnusedAudio = async (activeIds: string[]): Promise<void> => {
    try {
        const db = await initDB();
        const allKeys = await db.getAllKeys('audio');
        const activeSet = new Set(activeIds);

        let deletedCount = 0;
        for (const key of allKeys) {
            if (!activeSet.has(key as string)) {
                await db.delete('audio', key);
                deletedCount++;
            }
        }
        if (deletedCount > 0) {
            console.log(`[Cache Cleanup]: Removed ${deletedCount} unused stream(s) to save storage.`);
        }
    } catch (e) {
        console.error('[Cache Cleanup] Error pruning unused audio:', e);
    }
};
