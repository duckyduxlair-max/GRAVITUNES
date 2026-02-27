/**
 * Global Sleep Timer — persists across page navigation.
 * Lives outside React so it doesn't reset when Settings unmounts.
 */
import { usePlayerStore } from '../store/playerStore';

let _timerInterval: ReturnType<typeof setInterval> | null = null;
let _remaining = 0;
let _totalMinutes = 0;
let _listeners: Array<(remaining: number, total: number) => void> = [];

function notify() {
    _listeners.forEach(fn => fn(_remaining, _totalMinutes));
}

export const sleepTimerService = {
    start(minutes: number) {
        this.cancel();
        _totalMinutes = minutes;
        _remaining = minutes * 60;
        notify();
        _timerInterval = setInterval(() => {
            _remaining--;
            if (_remaining <= 0) {
                this.cancel();
                // Stop playback
                usePlayerStore.getState().setIsPlaying(false);
                // Try shutdown
                const API_BASE = import.meta.env.VITE_API_URL || '/api';
                fetch(`${API_BASE}/shutdown`, { method: 'POST' }).catch(() => { });
            }
            notify();
        }, 1000);
    },

    cancel() {
        if (_timerInterval) clearInterval(_timerInterval);
        _timerInterval = null;
        _remaining = 0;
        _totalMinutes = 0;
        notify();
    },

    getRemaining(): number { return _remaining; },
    getTotalMinutes(): number { return _totalMinutes; },
    isActive(): boolean { return _remaining > 0; },

    subscribe(fn: (remaining: number, total: number) => void) {
        _listeners.push(fn);
        return () => { _listeners = _listeners.filter(l => l !== fn); };
    }
};
