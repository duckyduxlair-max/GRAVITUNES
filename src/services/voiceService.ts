/**
 * GraviTunes Voice Assistant — "Gravi"
 * Uses Web Speech API for recognition + synthesis.
 * - Continuous listening with auto-restart
 * - Emits GRAVI_POPUP for UI notifications
 * - Does NOT pause music (SpeechRecognition doesn't use getUserMedia)
 */

import { usePlayerStore } from '../store/playerStore';
import { eventBus, Events } from './eventBus';

let recognition: any = null;
let isListening = false;
let shouldListen = false; // tracks user intent (survives recognition.onend)
let onResult: ((text: string) => void) | null = null;
let onStatus: ((status: string) => void) | null = null;

const SpeechRecognitionAPI =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

export function isVoiceSupported(): boolean {
    return !!SpeechRecognitionAPI && 'speechSynthesis' in window;
}

export function startListening(
    resultCallback: (text: string) => void,
    statusCallback?: (status: string) => void
): boolean {
    if (!SpeechRecognitionAPI) return false;

    onResult = resultCallback;
    onStatus = statusCallback || null;
    shouldListen = true;

    return restartRecognition();
}

function restartRecognition(): boolean {
    if (!shouldListen) return false;

    if (recognition) {
        try { recognition.abort(); } catch { /* ignore */ }
    }

    recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isListening = true;
        onStatus?.('Listening...');
        eventBus.emit(Events.VOICE_STATUS, 'listening');
    };

    recognition.onresult = (event: any) => {
        // Only process the latest result
        const lastIdx = event.results.length - 1;
        const transcript = event.results[lastIdx]?.[0]?.transcript?.trim() || '';
        const confidence = event.results[lastIdx]?.[0]?.confidence || 0;

        // Ignore low-confidence results (filters music / background noise)
        if (!transcript || confidence < 0.5) return;

        onStatus?.(`Heard: "${transcript}"`);
        processCommand(transcript.toLowerCase());
        onResult?.(transcript);
    };

    recognition.onerror = (event: any) => {
        console.warn('Voice recognition error:', event.error);

        if (event.error === 'not-allowed') {
            isListening = false;
            shouldListen = false;
            onStatus?.('Microphone access denied');
            eventBus.emit(Events.VOICE_STATUS, 'denied');
            eventBus.emit(Events.GRAVI_POPUP, { text: 'Mic access denied', type: 'error' });
            return;
        }

        // Auto-restart on transient errors (network, aborted, no-speech)
        if (shouldListen) {
            setTimeout(() => restartRecognition(), 1000);
        }
    };

    recognition.onend = () => {
        isListening = false;
        // Auto-restart if user hasn't explicitly stopped
        if (shouldListen) {
            setTimeout(() => restartRecognition(), 300);
        } else {
            onStatus?.('Stopped');
            eventBus.emit(Events.VOICE_STATUS, 'stopped');
        }
    };

    try {
        recognition.start();
        return true;
    } catch (err) {
        console.error('Failed to start voice recognition:', err);
        if (shouldListen) {
            setTimeout(() => restartRecognition(), 2000);
        }
        return false;
    }
}

export function stopListening(): void {
    shouldListen = false;
    if (recognition) {
        try { recognition.abort(); } catch { /* ignore */ }
        recognition = null;
    }
    isListening = false;
    onStatus?.('Stopped');
    eventBus.emit(Events.VOICE_STATUS, 'stopped');
}

export function getIsListening(): boolean {
    return isListening;
}

// ── Tab visibility handling ──
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isListening) {
            // Pause listening when tab is hidden to save resources
            if (recognition) {
                try { recognition.abort(); } catch { /* ignore */ }
            }
            isListening = false;
        } else if (!document.hidden && shouldListen) {
            // Resume when tab is visible again
            restartRecognition();
        }
    });
}

// ── Voice command processing ──
function processCommand(text: string): void {
    const store = usePlayerStore.getState();

    // Greeting
    if (text.includes('hi gravi') || text.includes('hey gravi') || text.includes('hello gravi')) {
        speak('Hey! I\'m Gravi. What can I do for you?');
        eventBus.emit(Events.GRAVI_POPUP, { text: 'Hey! I\'m Gravi 🎵', type: 'greeting' });
        return;
    }

    // Play / Resume
    if (text.includes('play') && !text.includes('next') && !text.includes('previous')) {
        store.setIsPlaying(true);
        speak('Playing music');
        eventBus.emit(Events.GRAVI_POPUP, { text: '▶ Playing', type: 'command' });
        return;
    }

    // Pause / Stop
    if (text.includes('pause') || text.includes('stop')) {
        store.setIsPlaying(false);
        speak('Music paused');
        eventBus.emit(Events.GRAVI_POPUP, { text: '⏸ Paused', type: 'command' });
        return;
    }

    // Next
    if (text.includes('next') || text.includes('skip')) {
        store.playNext();
        speak('Playing next');
        eventBus.emit(Events.GRAVI_POPUP, { text: '⏭ Next track', type: 'command' });
        return;
    }

    // Previous / Back
    if (text.includes('previous') || text.includes('back')) {
        store.playPrevious();
        speak('Playing previous');
        eventBus.emit(Events.GRAVI_POPUP, { text: '⏮ Previous track', type: 'command' });
        return;
    }

    // Shuffle
    if (text.includes('shuffle')) {
        store.toggleShuffle();
        const msg = store.isShuffle ? '🔀 Shuffle ON' : '🔀 Shuffle OFF';
        speak(store.isShuffle ? 'Shuffle on' : 'Shuffle off');
        eventBus.emit(Events.GRAVI_POPUP, { text: msg, type: 'command' });
        return;
    }

    // Repeat
    if (text.includes('repeat') || text.includes('loop')) {
        store.toggleRepeat();
        const msg = `🔁 Repeat ${store.repeatMode}`;
        speak(`Repeat ${store.repeatMode.toLowerCase()}`);
        eventBus.emit(Events.GRAVI_POPUP, { text: msg, type: 'command' });
        return;
    }

    // Unrecognized — show popup but don't interrupt
    eventBus.emit(Events.GRAVI_POPUP, { text: `"${text}" — not a command`, type: 'info' });
}

// ── Text-to-Speech (Gravi's voice) ──
export function speak(text: string): void {
    if (!('speechSynthesis' in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.1;
    utterance.volume = 0.7;

    // Try to find a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
        v.name.includes('Google') ||
        v.name.includes('Samantha') ||
        v.name.includes('Daniel')
    );
    if (preferred) utterance.voice = preferred;

    window.speechSynthesis.speak(utterance);
}
