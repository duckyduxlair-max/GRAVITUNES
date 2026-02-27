import React, { useRef, useEffect, useState } from 'react';
import { globalAudio, globalAnalyzer } from './AudioController';

const WaveProgress: React.FC = () => {
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [seekPercent, setSeekPercent] = useState(0);
    const [bassIntensity, setBassIntensity] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const formatTime = (time: number) => {
        if (!time || isNaN(time)) return '0:00';
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        let frameId: number;
        const update = () => {
            if (globalAudio) {
                setCurrentTime(globalAudio.currentTime);
                setDuration(globalAudio.duration || 0);
            }
            if (globalAnalyzer) {
                const arr = new Uint8Array(16);
                globalAnalyzer.getByteFrequencyData(arr);
                let sum = 0;
                for (let i = 0; i < 4; i++) sum += arr[i];
                setBassIntensity(sum / 4 / 255);
            }
            frameId = requestAnimationFrame(update);
        };
        update();
        return () => cancelAnimationFrame(frameId);
    }, []);

    const progress = duration ? currentTime / duration : 0;
    const activePercent = isDragging ? seekPercent : progress;

    // Draw falling star trail on canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const W = rect.width;
        const H = rect.height;

        ctx.clearRect(0, 0, W, H);

        const y = H / 2;
        const headX = activePercent * W;
        const glowIntensity = 0.4 + bassIntensity * 0.6;

        // Get accent color from CSS variable
        const computedStyle = getComputedStyle(document.documentElement);
        const accentRgb = computedStyle.getPropertyValue('--accent-rgb').trim() || '212,175,55';
        const accent = computedStyle.getPropertyValue('--accent').trim() || '#D4AF37';

        // 1. Background track
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();

        if (activePercent > 0.001) {
            // 2. Meteor tail — fading gradient trail
            const tailLength = Math.min(headX, W * 0.35);
            const tailStart = Math.max(0, headX - tailLength);
            const tailGrad = ctx.createLinearGradient(tailStart, y, headX, y);
            tailGrad.addColorStop(0, `rgba(${accentRgb}, 0)`);
            tailGrad.addColorStop(0.5, `rgba(${accentRgb}, ${0.15 * glowIntensity})`);
            tailGrad.addColorStop(1, `rgba(${accentRgb}, ${0.7 * glowIntensity})`);

            ctx.beginPath();
            ctx.moveTo(tailStart, y);
            ctx.lineTo(headX, y);
            ctx.strokeStyle = tailGrad;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.stroke();

            // 3. Bright core trail (thinner, sharper)
            const coreLength = Math.min(headX, W * 0.15);
            const coreStart = Math.max(0, headX - coreLength);
            const coreGrad = ctx.createLinearGradient(coreStart, y, headX, y);
            coreGrad.addColorStop(0, `rgba(${accentRgb}, 0)`);
            coreGrad.addColorStop(1, `rgba(${accentRgb}, ${glowIntensity})`);

            ctx.beginPath();
            ctx.moveTo(coreStart, y);
            ctx.lineTo(headX, y);
            ctx.strokeStyle = coreGrad;
            ctx.lineWidth = 2;
            ctx.stroke();

            // 4. Falling star sparks/particles
            const sparkCount = Math.floor(3 + bassIntensity * 5);
            for (let i = 0; i < sparkCount; i++) {
                const sparkX = headX - Math.random() * tailLength * 0.6;
                const sparkY = y + (Math.random() - 0.5) * (8 + bassIntensity * 12);
                const sparkSize = 0.5 + Math.random() * 1.5;
                const sparkAlpha = Math.random() * 0.4 * glowIntensity;

                ctx.beginPath();
                ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${accentRgb}, ${sparkAlpha})`;
                ctx.fill();
            }

            // 5. Meteor head — glowing star
            // Outer glow
            const headGlow = ctx.createRadialGradient(headX, y, 0, headX, y, 12 + bassIntensity * 8);
            headGlow.addColorStop(0, `rgba(${accentRgb}, ${0.5 * glowIntensity})`);
            headGlow.addColorStop(0.5, `rgba(${accentRgb}, ${0.15 * glowIntensity})`);
            headGlow.addColorStop(1, `rgba(${accentRgb}, 0)`);
            ctx.beginPath();
            ctx.arc(headX, y, 12 + bassIntensity * 8, 0, Math.PI * 2);
            ctx.fillStyle = headGlow;
            ctx.fill();

            // Core dot
            ctx.beginPath();
            ctx.arc(headX, y, 4 + bassIntensity * 2, 0, Math.PI * 2);
            ctx.fillStyle = accent;
            ctx.fill();

            // White hot center
            ctx.beginPath();
            ctx.arc(headX, y, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + bassIntensity * 0.3})`;
            ctx.fill();
        }
    }, [activePercent, bassIntensity]);

    const handleSeek = (e: React.MouseEvent | React.TouchEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const x = (clientX - rect.left) / rect.width;
        const percent = Math.max(0, Math.min(1, x));
        setSeekPercent(percent);
    };

    const commitSeek = () => {
        if (globalAudio && globalAudio.duration) {
            globalAudio.currentTime = globalAudio.duration * seekPercent;
        }
        setIsDragging(false);
    };

    return (
        <div className="w-full select-none">
            <div
                ref={containerRef}
                className="relative w-full h-16 cursor-pointer group"
                onMouseDown={(e) => { setIsDragging(true); handleSeek(e); }}
                onMouseMove={(e) => isDragging && handleSeek(e)}
                onMouseUp={commitSeek}
                onMouseLeave={() => isDragging && commitSeek()}
                onTouchStart={(e) => { setIsDragging(true); handleSeek(e); }}
                onTouchMove={(e) => isDragging && handleSeek(e)}
                onTouchEnd={commitSeek}
            >
                <canvas
                    ref={canvasRef}
                    className="w-full h-full"
                    style={{ imageRendering: 'auto' }}
                />
            </div>

            {/* Time Labels */}
            <div className="flex justify-between items-center text-[10px] font-black tracking-[0.2em] text-white/30 px-2 -mt-2 uppercase">
                <span className={activePercent > 0 ? "text-accent/60" : ""}>{formatTime(isDragging ? duration * seekPercent : currentTime)}</span>
                <span className="opacity-50">{formatTime(duration)}</span>
            </div>
        </div>
    );
};

export default WaveProgress;
