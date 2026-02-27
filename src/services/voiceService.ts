/**
 * GraviTunes Voice Assistant — "Gravi"
 * Uses Web Speech API for recognition + synthesis.
 * Resilient: auto-restarts on error, pauses on tab blur.
 */

import { usePlayerStore } from '../store/playerStore';
import { eventBus, Events } from './eventBus';

type VoiceCallback = (text: string) => void;

let recognition: any = null;
let isListening = false;
let onResult: VoiceCallback | null = null;
let onStatus: ((status: string) => void) | null = null;
let restartTimeout: ReturnType<typeof setTimeout> | null = null;

const SpeechRecognitionAPI =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

export function isVoiceSupported(): boolean {
    return !!SpeechRecognitionAPI && 'speechSynthesis' in window;
}

export function startListening(
    resultCallback: VoiceCallback,
    statusCallback?: (status: string) => void
): boolean {
    if (!SpeechRecognitionAPI) return false;

    onResult = resultCallback;
    onStatus = statusCallback || null;

    if (recognition) {
        try { recognition.abort(); } catch { /* ignore */ }
    }

    recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isListening = true;
        onStatus?.('Listening...');
        eventBus.emit(Events.VOICE_STATUS, 'listening');
    };

    recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript || '';
        if (transcript) {
            onStatus?.(`Heard: "${transcript}"`);
            processCommand(transcript.toLowerCase());
            onResult?.(transcript);
        }
    };

    recognition.onerror = (event: any) => {
        console.warn('Voice recognition error:', event.error);
        isListening = false;

        if (event.error === 'not-allowed') {
            onStatus?.('Microphone access denied');
            eventBus.emit(Events.VOICE_STATUS, 'denied');
            return;
        }

        // Auto-restart on transient errors
        if (event.error === 'network' || event.error === 'aborted') {
            onStatus?.('Reconnecting...');
            scheduleRestart();
        }
    };

    recognition.onend = () => {
        isListening = false;
        onStatus?.('Ready');
        eventBus.emit(Events.VOICE_STATUS, 'idle');
    };

    try {
        recognition.start();
        return true;
    } catch (err) {
        console.error('Failed to start voice recognition:', err);
        return false;
    }
}

export function stopListening(): void {
    if (restartTimeout) {
        clearTimeout(restartTimeout);
        restartTimeout = null;
    }
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

function scheduleRestart(): void {
    if (restartTimeout) clearTimeout(restartTimeout);
    restartTimeout = setTimeout(() => {
        if (onResult) {
            startListening(onResult, onStatus || undefined);
        }
    }, 2000);
}

// ── Tab visibility handling ──
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isListening) {
            stopListening();
        }
    });
}

// ── Voice command processing ──
function processCommand(text: string): void {
    const store = usePlayerStore.getState();

    // Play / Resume
    if (text.includes('play') && !text.includes('next') && !text.includes('previous')) {
        store.setIsPlaying(true);
        speak('Playing music');
        return;
    }

    // Pause / Stop
    if (text.includes('pause') || text.includes('stop')) {
        store.setIsPlaying(false);
        speak('Music paused');
        return;
    }

    // Next
    if (text.includes('next') || text.includes('skip')) {
        store.playNext();
        speak('Playing next');
        return;
    }

    // Previous
    if (text.includes('previous') || text.includes('back')) {
        store.playPrevious();
        speak('Playing previous');
        return;
    }

    // Shuffle
    if (text.includes('shuffle')) {
        store.toggleShuffle();
        speak(store.isShuffle ? 'Shuffle on' : 'Shuffle off');
        return;
    }

    // Repeat
    if (text.includes('repeat') || text.includes('loop')) {
        store.toggleRepeat();
        speak(`Repeat ${store.repeatMode.toLowerCase()}`);
        return;
    }

    speak("Sorry, I didn't understand that command.");
}

// ── Text-to-Speech (Gravi's voice) ──
export function speak(text: string): void {
    if (!('speechSynthesis' in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

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
