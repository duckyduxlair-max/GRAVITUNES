import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
    analyzer: AnalyserNode | null;
    isPlaying: boolean;
    className?: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyzer, isPlaying, className = '' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);

    useEffect(() => {
        if (!analyzer || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bufferLength = analyzer.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationRef.current = requestAnimationFrame(draw);

            // Fetch dynamic theme colors (Canvas cannot parse var() directly)
            const styles = getComputedStyle(document.documentElement);
            const accentRGB = styles.getPropertyValue('--accent-rgb').trim() || '212, 175, 55';
            const accentHex = styles.getPropertyValue('--accent').trim() || '#D4AF37';

            // Overlapping glowing waves
            const waves = [
                { color: accentHex, glow: `rgba(${accentRGB}, 0.5)`, alpha: 1, offset: 0, ampMult: 1, speed: 0.003, lineWidth: 2, yOffset: 0 },
                { color: `rgba(${accentRGB}, 0.7)`, glow: `rgba(${accentRGB}, 0.5)`, alpha: 0.8, offset: Math.PI / 4, ampMult: 0.7, speed: 0.004, lineWidth: 1.5, yOffset: 2 },
                { color: '#ffffff', glow: `rgba(${accentRGB}, 0.5)`, alpha: 0.4, offset: Math.PI / 2, ampMult: 0.5, speed: 0.002, lineWidth: 1, yOffset: -2 }
            ];

            // Create motion blur effect
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (!isPlaying) {
                // Draw flat line when paused
                ctx.beginPath();
                ctx.moveTo(0, canvas.height / 2);
                ctx.lineTo(canvas.width, canvas.height / 2);
                ctx.strokeStyle = `rgba(${accentRGB}, 0.2)`;
                ctx.shadowBlur = 10;
                ctx.shadowColor = accentHex;
                ctx.lineWidth = 1;
                ctx.stroke();
                return;
            }

            analyzer.getByteFrequencyData(dataArray);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const t = performance.now();

            waves.forEach(wave => {
                ctx.beginPath();
                ctx.moveTo(0, canvas.height / 2);

                for (let i = 0; i < canvas.width; i += 2) {
                    const dataIndex = Math.floor((i / canvas.width) * (bufferLength * 0.4));
                    const dataValue = (dataArray[dataIndex] || 0) / 255.0;
                    const baseSine = Math.sin(i * 0.015 + t * wave.speed + wave.offset);
                    const complexSine = baseSine * 0.7 + Math.sin(i * 0.03 - t * wave.speed) * 0.3;
                    const distanceToCenter = Math.abs(i - canvas.width / 2) / (canvas.width / 2);
                    const envelope = Math.max(0, 1 - Math.pow(distanceToCenter, 1.5));
                    const amplitude = (5 + dataValue * (canvas.height * 0.6)) * wave.ampMult * envelope;
                    const y = (canvas.height / 2) + (complexSine * amplitude) + wave.yOffset;
                    ctx.lineTo(i, y);
                }

                ctx.strokeStyle = wave.color;
                ctx.globalAlpha = wave.alpha;
                ctx.lineWidth = wave.lineWidth;
                ctx.shadowBlur = 15;
                ctx.shadowColor = wave.glow;
                ctx.stroke();
            });
            ctx.globalAlpha = 1.0;
        };

        animationRef.current = requestAnimationFrame(draw);

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [analyzer, isPlaying]);

    return (
        <div className={`pointer-events-none overflow-hidden ${className}`}>
            <canvas
                ref={canvasRef}
                width={300}
                height={60}
                className="w-full h-full object-cover"
            />
        </div>
    );
};

export default AudioVisualizer;
