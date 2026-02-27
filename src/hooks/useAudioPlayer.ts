import { useEffect, useState } from 'react';
import { globalAudio, globalAnalyzer } from '../components/player/AudioController';

export { globalAudio, globalAnalyzer };

export const useAudioPlayer = () => {
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const updateTime = () => setCurrentTime(globalAudio.currentTime);
        const updateDuration = () => setDuration(globalAudio.duration);
        const setReady = () => setIsReady(true);

        globalAudio.addEventListener('timeupdate', updateTime);
        globalAudio.addEventListener('loadedmetadata', updateDuration);
        globalAudio.addEventListener('canplay', setReady);

        // Sync initial state
        setCurrentTime(globalAudio.currentTime);
        setDuration(globalAudio.duration);
        if (globalAudio.readyState >= 2) setIsReady(true);

        return () => {
            globalAudio.removeEventListener('timeupdate', updateTime);
            globalAudio.removeEventListener('loadedmetadata', updateDuration);
            globalAudio.removeEventListener('canplay', setReady);
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
        analyzer: globalAnalyzer
    };
};
