import { useEffect, useState } from 'react';
import { globalAudio, globalAnalyzer } from '../components/player/AudioController';
import { eventBus, Events } from '../services/eventBus';

export { globalAudio, globalAnalyzer };

export const useAudioPlayer = () => {
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isReady, setIsReady] = useState(false);
    const [analyzer, setAnalyzer] = useState<AnalyserNode | null>(globalAnalyzer);

    useEffect(() => {
        const updateTime = () => setCurrentTime(globalAudio.currentTime);
        const updateDuration = () => setDuration(globalAudio.duration);
        const setReady = () => setIsReady(true);
        const updateAnalyzer = (a: AnalyserNode) => setAnalyzer(a);

        globalAudio.addEventListener('timeupdate', updateTime);
        globalAudio.addEventListener('loadedmetadata', updateDuration);
        globalAudio.addEventListener('canplay', setReady);
        const unsubAnalyzer = eventBus.on(Events.ANALYZER_READY, updateAnalyzer);

        // Sync initial state
        setCurrentTime(globalAudio.currentTime);
        setDuration(globalAudio.duration);
        if (globalAudio.readyState >= 2) setIsReady(true);
        if (globalAnalyzer && !analyzer) setAnalyzer(globalAnalyzer);

        return () => {
            globalAudio.removeEventListener('timeupdate', updateTime);
            globalAudio.removeEventListener('loadedmetadata', updateDuration);
            globalAudio.removeEventListener('canplay', setReady);
            unsubAnalyzer();
        };
    }, []);

    const seek = (time: number) => {
        globalAudio.currentTime = time;
        setCurrentTime(time);
    };

    return {
        currentTime,
        duration,
        seek,
        isReady,
        analyzer
    };
};
