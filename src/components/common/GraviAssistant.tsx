import React, { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import { isVoiceSupported, startListening, stopListening, speak } from '../../services/voiceService';
import { usePlayerStore } from '../../store/playerStore';

const GraviAssistant: React.FC = () => {
    const [isEnabled, setIsEnabled] = useState(localStorage.getItem('gravi_enabled') === 'true');
    const [isActive, setIsActive] = useState(false); // When "Hi Gravi" is detected
    const [transcript, setTranscript] = useState('');

    useEffect(() => {
        const checkEnabled = () => {
            const enabled = localStorage.getItem('gravi_enabled') === 'true';
            if (enabled !== isEnabled) {
                setIsEnabled(enabled);
            }
        };
        const interval = setInterval(checkEnabled, 1000);
        return () => clearInterval(interval);
    }, [isEnabled]);

    useEffect(() => {
        if (!isEnabled || !isVoiceSupported()) {
            stopListening();
            return;
        }

        let isMounted = true;
        let wakeTimeout: ReturnType<typeof setTimeout>;

        const handleStatus = (s: string) => {
            if (!isMounted) return;
            // Auto-restart if it stops and we are enabled
            if (s === 'Ready' || s === 'Stopped') {
                if (localStorage.getItem('gravi_enabled') === 'true') {
                    // Slight delay to prevent aggressive looping
                    setTimeout(() => {
                        if (isMounted) startListening(handleResult, handleStatus);
                    }, 500);
                }
            }
        };

        const handleResult = (text: string) => {
            if (!isMounted) return;
            const lower = text.toLowerCase();
            setTranscript(text);

            if (lower.includes('hi gravi') || lower.includes('hey gravi') || lower.includes('gravity')) {
                setIsActive(true);
                speak('Yes?');
                clearTimeout(wakeTimeout);
                wakeTimeout = setTimeout(() => setIsActive(false), 5000);
            } else if (isActive) {
                // Process command if we are awake
                processCommand(lower);
                clearTimeout(wakeTimeout);
                wakeTimeout = setTimeout(() => setIsActive(false), 3000);
            }
        };

        startListening(handleResult, handleStatus);

        return () => {
            isMounted = false;
            stopListening();
            clearTimeout(wakeTimeout);
        };
    }, [isEnabled]);

    const processCommand = (text: string) => {
        const store = usePlayerStore.getState();

        if (text.includes('play') && !text.includes('next') && !text.includes('previous')) {
            store.setIsPlaying(true);
            speak('Playing');
            setIsActive(false);
            return;
        }
        if (text.includes('pause') || text.includes('stop')) {
            store.setIsPlaying(false);
            speak('Paused');
            setIsActive(false);
            return;
        }
        if (text.includes('next') || text.includes('skip')) {
            store.playNext();
            speak('Next');
            setIsActive(false);
            return;
        }
        if (text.includes('back') || text.includes('previous')) {
            store.playPrevious();
            speak('Previous');
            setIsActive(false);
            return;
        }
    };

    if (!isEnabled || !isActive) return null;

    return (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="bg-black/80 backdrop-blur-xl border border-accent/30 rounded-full px-6 py-3 flex items-center gap-4 shadow-[0_0_30px_rgba(212,175,55,0.4)]">
                <div className="relative">
                    <div className="absolute inset-0 bg-accent/30 rounded-full animate-ping" />
                    <div className="relative bg-accent rounded-full p-2">
                        <Mic size={18} className="text-black animate-pulse" />
                    </div>
                </div>
                <div className="flex flex-col max-w-[200px]">
                    <span className="text-xs text-accent font-bold tracking-widest uppercase">Gravi Listens</span>
                    <span className="text-white text-sm font-medium truncate">
                        {transcript ? `"${transcript}"` : "Say a command..."}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default GraviAssistant;
