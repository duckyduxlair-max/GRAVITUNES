/**
 * Global Sleep Timer — persists across tab navigation.
 * Uses a module-level interval so it survives React component unmounts.
 */

import { usePlayerStore } from '../store/playerStore';

let sleepInterval: ReturnType<typeof setInterval> | null = null;
let sleepRemainingSec = 0;
let sleepTotalMin = 0;
let listeners: Set<() => void> = new Set();

function notify() {
    listeners.forEach(cb => cb());
}

export function startSleepTimer(minutes: number) {
    cancelSleepTimer();
    sleepTotalMin = minutes;
    sleepRemainingSec = minutes * 60;
    sleepInterval = setInterval(() => {
        sleepRemainingSec--;
        if (sleepRemainingSec <= 0) {
            cancelSleepTimer();
            usePlayerStore.getState().setIsPlaying(false);
            const API_BASE = import.meta.env.VITE_API_URL || '/api';
            fetch(`${API_BASE}/shutdown`, { method: 'POST' }).catch(() => { });
        }
        notify();
    }, 1000);
    notify();
}

export function cancelSleepTimer() {
    if (sleepInterval) {
        clearInterval(sleepInterval);
        sleepInterval = null;
    }
    sleepTotalMin = 0;
    sleepRemainingSec = 0;
    notify();
}

export function getSleepState() {
    return {
        active: sleepTotalMin > 0,
        minutes: sleepTotalMin,
        remaining: sleepRemainingSec,
    };
}

/** Subscribe to timer changes. Returns unsubscribe fn. */
export function onSleepChange(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
}
