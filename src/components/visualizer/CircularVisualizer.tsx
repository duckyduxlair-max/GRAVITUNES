import React, { useRef, useEffect } from 'react';
import { globalAnalyzer } from '../../hooks/useAudioPlayer';

interface CircularVisualizerProps {
    isPlaying: boolean;
    colorRGB?: string;
}

const CircularVisualizer: React.FC<CircularVisualizerProps> = ({ isPlaying, colorRGB }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Particle System for Sun Flares & Sparks
        class Flare {
            x: number = 0;
            y: number = 0;
            angle: number;
            speedX: number;
            speedY: number;
            life: number;
            maxLife: number;
            size: number;
            color: string;

            constructor(baseRadius: number, explicitColor?: string) {
                this.angle = Math.random() * Math.PI * 2;

                // Spawn exactly on the visualizer line
                const spawnRadius = baseRadius;

                // Initial position relative to center
                this.x = Math.cos(this.angle) * spawnRadius;
                this.y = Math.sin(this.angle) * spawnRadius;

                // Move outwards and downwards (sparks falling effect)
                const force = Math.random() * 2 + 1;
                this.speedX = Math.cos(this.angle) * force;
                this.speedY = (Math.sin(this.angle) * force) + (Math.random() * 2); // bias downward gravity

                this.maxLife = Math.random() * 60 + 20;
                this.life = this.maxLife;

                if (explicitColor) {
                    this.color = explicitColor;
                } else {
                    // Neon sun flare colors fallback
                    const colors = ['255,250,200', '255,220,100', '255,150,50'];
                    this.color = colors[Math.floor(Math.random() * colors.length)];
                }

                this.size = Math.random() * 3 + 1;
            }

            update(bassIntensity: number) {
                // Gravity & Explosion
                this.x += this.speedX * (1 + bassIntensity * 2);
                this.y += this.speedY + (bassIntensity * 3); // fall faster on bass

                this.life--;
                this.size *= 0.96; // shrink as it dies
            }

            draw(ctx: CanvasRenderingContext2D) {
                if (this.life <= 0) return;

                const opacity = this.life / this.maxLife;
                const outer = this.size * 3; // Make flare reach further

                // Draw 4-point sleek star using quadratic curves
                ctx.beginPath();
                ctx.moveTo(this.x, this.y - outer); // Top peak
                ctx.quadraticCurveTo(this.x, this.y, this.x + outer, this.y); // Curve to Right
                ctx.quadraticCurveTo(this.x, this.y, this.x, this.y + outer); // Curve to Bottom
                ctx.quadraticCurveTo(this.x, this.y, this.x - outer, this.y); // Curve to Left
                ctx.quadraticCurveTo(this.x, this.y, this.x, this.y - outer); // Back to Top

                ctx.fillStyle = `rgba(${this.color}, ${opacity})`;
                ctx.fill();

                // Bright sharp center
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 2})`;
                ctx.fill();

                // Glow
                ctx.shadowBlur = 15;
                ctx.shadowColor = `rgba(${this.color}, ${opacity})`;
            }
        }

        let flares: Flare[] = [];
        let rotation = 0;

        const render = () => {
            if (!canvas.parentElement) return;

            // Match canvas to parent size
            const dpr = window.devicePixelRatio || 1;
            const logicalWidth = canvas.parentElement.clientWidth;
            const logicalHeight = canvas.parentElement.clientHeight;

            if (canvas.width !== logicalWidth * dpr || canvas.height !== logicalHeight * dpr) {
                canvas.width = logicalWidth * dpr;
                canvas.height = logicalHeight * dpr;
                ctx.scale(dpr, dpr);
            }

            const width = logicalWidth;
            const height = logicalHeight;

            // Darken/Clear
            ctx.clearRect(0, 0, width, height);

            if (!isPlaying && !globalAnalyzer && flares.length === 0) {
                return;
            }

            // Fetch audio data and calculate average bass
            let bassIntensity = 0;
            let audioDataArr = new Uint8Array(64);

            if (globalAnalyzer) {
                globalAnalyzer.getByteFrequencyData(audioDataArr);

                // Average the lower frequency bands for "bass" detection
                let sum = 0;
                for (let i = 0; i < 10; i++) sum += audioDataArr[i];
                const avgBass = sum / 10;
                bassIntensity = avgBass / 255;
            }

            const centerX = width / 2;
            const centerY = height / 2;

            // Tightly hug the album art container (Image is strictly 25% of Canvas Diameter now)
            // Image 0.5 * Container -> Canvas 2.0 * Container = Image 0.25 * Canvas
            const baseRadius = Math.min(centerX, centerY) * 0.25;

            const numBars = 64; // Use all 64 bytes
            const angleStep = (Math.PI * 2) / numBars;

            // --- 1. Draw Fluid Liquid Blob ---
            // Slowly rotate the visualizer liquid
            rotation -= 0.002;
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(rotation);

            // Smooth the values for a fluid liquid effect
            const smoothedValues = new Array(numBars).fill(0);
            const smoothingWindow = 2; // how many neighbors to average
            for (let i = 0; i < numBars; i++) {
                let sum = 0;
                let count = 0;
                for (let j = -smoothingWindow; j <= smoothingWindow; j++) {
                    const idx = (i + j + numBars) % numBars;
                    sum += (audioDataArr ? audioDataArr[idx] : 0);
                    count++;
                }
                smoothedValues[i] = sum / count;
            }

            // Generate points for the continuous curve
            const points = [];
            for (let i = 0; i < numBars; i++) {
                const value = smoothedValues[i];
                // Exponential scaling for the bass hits
                const percent = Math.pow(value / 255, 1.5);
                const bulge = percent * (baseRadius * 0.2); // max liquid spread

                const angle = i * angleStep;
                const r = baseRadius + bulge;

                points.push({
                    x: Math.cos(angle) * r,
                    y: Math.sin(angle) * r
                });
            }

            // Draw smooth curve connecting points
            ctx.beginPath();
            if (points.length > 0) {
                // Start halfway between last and first point to close the loop smoothly
                const startXC = (points[points.length - 1].x + points[0].x) / 2;
                const startYC = (points[points.length - 1].y + points[0].y) / 2;
                ctx.moveTo(startXC, startYC);

                for (let i = 0; i < points.length; i++) {
                    const curr = points[i];
                    const next = points[(i + 1) % points.length];
                    const xc = (curr.x + next.x) / 2;
                    const yc = (curr.y + next.y) / 2;

                    ctx.quadraticCurveTo(curr.x, curr.y, xc, yc);
                }
            }
            ctx.closePath();

            // Core Styling - liquid glowing mass matching extracted color
            const themeColor = colorRGB || '255, 255, 255';

            // Outer glow line
            ctx.strokeStyle = `rgba(${themeColor}, 0.8)`;
            ctx.lineWidth = 4;
            ctx.lineJoin = 'round';
            ctx.shadowBlur = 20;
            ctx.shadowColor = `rgba(${themeColor}, 1)`;
            ctx.stroke();

            // Inner liquid fill
            ctx.fillStyle = `rgba(${themeColor}, 0.15)`;
            ctx.fill();

            // Additional strong inner glow/core
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = `rgba(255, 255, 255, 0.5)`;
            ctx.stroke();
            ctx.restore(); // Restore rotation

            // --- 2. Particle System (Sparks on hard bass hits) ---
            // Spawn new flares based on hard audio intensity
            if (isPlaying && bassIntensity > 0.65) {
                // Spawn a few strong bursts
                const spawnCount = Math.floor(bassIntensity * 5);
                for (let i = 0; i < spawnCount; i++) {
                    flares.push(new Flare(baseRadius, colorRGB));
                }
            }

            ctx.save();
            ctx.translate(centerX, centerY);

            // Update and draw
            for (let i = flares.length - 1; i >= 0; i--) {
                const f = flares[i];
                f.update(bassIntensity);
                f.draw(ctx);

                if (f.life <= 0) {
                    flares.splice(i, 1);
                }
            }

            ctx.restore();

            animationRef.current = requestAnimationFrame(render);
        };

        if (isPlaying) {
            render();
        } else {
            // Draw one frame to clear or set default state
            render();
        }

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isPlaying]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-[-50%] w-[200%] h-[200%] pointer-events-none mix-blend-screen z-[-1]"
        />
    );
};

export default CircularVisualizer;
