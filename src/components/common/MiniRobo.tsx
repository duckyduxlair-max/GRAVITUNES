import React, { useEffect, useRef } from 'react';

interface MiniRoboProps {
    analyzer: AnalyserNode | null;
    isPlaying: boolean;
}

const MiniRobo: React.FC<MiniRoboProps> = ({ analyzer, isPlaying }) => {
    const roboRef = useRef<HTMLDivElement>(null);
    const leftEyeRef = useRef<SVGRectElement>(null);
    const rightEyeRef = useRef<SVGRectElement>(null);
    const mouthRef = useRef<SVGRectElement>(null);
    const animationRef = useRef<number>(0);

    useEffect(() => {
        if (!analyzer || !isPlaying) {
            cancelAnimationFrame(animationRef.current);
            // Reset to calm state
            if (leftEyeRef.current) leftEyeRef.current.setAttribute('height', '8');
            if (rightEyeRef.current) rightEyeRef.current.setAttribute('height', '8');
            if (mouthRef.current) {
                mouthRef.current.setAttribute('height', '4');
                mouthRef.current.setAttribute('y', '32');
                mouthRef.current.setAttribute('rx', '2');
            }
            if (roboRef.current) {
                roboRef.current.style.transform = `translateY(0px)`;
            }
            return;
        }

        const dataArray = new Uint8Array(analyzer.frequencyBinCount);

        const updateExpression = () => {
            analyzer.getByteFrequencyData(dataArray);

            // Calculate averages for different frequency bands
            const bass = dataArray.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
            const mids = dataArray.slice(10, 50).reduce((a, b) => a + b, 0) / 40;
            const highs = dataArray.slice(50, 100).reduce((a, b) => a + b, 0) / 50;

            // Intensity 0 to 1
            const bassIntensity = bass / 255;
            const midIntensity = mids / 255;
            const highIntensity = highs / 255;

            // Animate Robo Body (Bounce on Bass)
            if (roboRef.current) {
                const bounce = bassIntensity * -10; // Jump up to 10px
                roboRef.current.style.transform = `translateY(${bounce}px)`;
            }

            // Animate Eyes (Widen on Highs)
            if (leftEyeRef.current && rightEyeRef.current) {
                const eyeHeight = 8 + (highIntensity * 12); // Base 8, max 20
                leftEyeRef.current.setAttribute('height', eyeHeight.toString());
                rightEyeRef.current.setAttribute('height', eyeHeight.toString());

                // Keep eyes centered vertically as they grow
                const eyeY = 16 - ((eyeHeight - 8) / 2);
                leftEyeRef.current.setAttribute('y', eyeY.toString());
                rightEyeRef.current.setAttribute('y', eyeY.toString());
            }

            // Animate Mouth (Open on Mids, like singing)
            if (mouthRef.current) {
                const mouthHeight = 4 + (midIntensity * 16); // Base 4, max 20
                mouthRef.current.setAttribute('height', mouthHeight.toString());

                // If loud enough, mouth becomes an O shape
                if (midIntensity > 0.5) {
                    mouthRef.current.setAttribute('rx', '8');
                    mouthRef.current.setAttribute('width', '16');
                    mouthRef.current.setAttribute('x', '16');
                } else {
                    mouthRef.current.setAttribute('rx', '2');
                    mouthRef.current.setAttribute('width', '24');
                    mouthRef.current.setAttribute('x', '12');
                }
            }

            animationRef.current = requestAnimationFrame(updateExpression);
        };

        updateExpression();

        return () => {
            cancelAnimationFrame(animationRef.current);
        };
    }, [analyzer, isPlaying]);

    return (
        <div
            ref={roboRef}
            className="fixed top-4 right-16 md:right-8 z-110 w-12 h-12 glass-card rounded-2xl flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.2)] border border-white/20 transition-transform duration-75 group/robo cursor-pointer hover:shadow-[0_0_25px_rgba(255,255,255,0.5)]"
            title="Music Intensity Bot"
        >
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute top-0 left-0">
                {/* Antenna */}
                <path d="M24 8V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-zinc-400 group-hover/robo:text-white" />
                <circle cx="24" cy="4" r="2" fill="currentColor" className={`${isPlaying ? 'text-[#00ccff] animate-pulse shadow-[0_0_10px_#00ccff]' : 'text-zinc-500'}`} />

                {/* Face Frame */}
                {/* Background glow when playing */}
                <rect x="6" y="8" width="36" height="32" rx="8" fill="transparent" stroke="currentColor" strokeWidth="2" className={`text-white/20 ${isPlaying ? 'theme-glow-border border-2' : ''}`} />

                {/* Eyes */}
                <rect ref={leftEyeRef} x="14" y="16" width="6" height="8" rx="3" fill="white" className="transition-all duration-75" />
                <rect ref={rightEyeRef} x="28" y="16" width="6" height="8" rx="3" fill="white" className="transition-all duration-75" />

                {/* Mouth */}
                <rect ref={mouthRef} x="12" y="32" width="24" height="4" rx="2" fill="white" className="transition-all duration-75" />
            </svg>
        </div>
    );
};

export default MiniRobo;
