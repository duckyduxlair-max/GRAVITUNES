/**
 * GraviTunes Event Bus — Lightweight pub/sub for cross-store decoupling
 * Every on() returns an unsubscribe function to prevent memory leaks.
 */

type EventHandler = (...args: any[]) => void;

class EventBus {
    private listeners: Map<string, Set<EventHandler>> = new Map();

    on(event: string, handler: EventHandler): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(handler);
        // Return unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(handler);
        };
    }

    off(event: string, handler: EventHandler): void {
        this.listeners.get(event)?.delete(handler);
    }

    emit(event: string, ...args: any[]): void {
        this.listeners.get(event)?.forEach(handler => {
            try {
                handler(...args);
            } catch (err) {
                console.error(`[EventBus] Error in handler for "${event}":`, err);
            }
        });
    }
}

// Singleton instance
export const eventBus = new EventBus();

// Event name constants
export const Events = {
    SONG_STARTED: 'SONG_STARTED',
    STREAM_ENDED: 'STREAM_ENDED',
    DOWNLOAD_STARTED: 'DOWNLOAD_STARTED',
    DOWNLOAD_COMPLETED: 'DOWNLOAD_COMPLETED',
    DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
    VOICE_COMMAND: 'VOICE_COMMAND',
    VOICE_STATUS: 'VOICE_STATUS',
    GRAVI_POPUP: 'GRAVI_POPUP',
    SLEEP_TIMER_FIRED: 'SLEEP_TIMER_FIRED',
    BUFFERING_CHANGE: 'BUFFERING_CHANGE',
} as const;
