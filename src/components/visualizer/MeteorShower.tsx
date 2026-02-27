import React, { useEffect, useRef } from 'react';
import { globalAnalyzer } from '../../hooks/useAudioPlayer';

const MeteorShower: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);

    // This component will create a synchronized 2D canvas of falling meteors whose speed, size, or opacity pulse to the music.
    // For now we will setup the basic structure and link it to the AudioVisualizer logic

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Ensure canvas fills screen perfectly
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        // Meteor classes
        class Meteor {
            x: number;
            y: number;
            speed: number;
            length: number;
            thickness: number;
            opacity: number;
            resetY: number;

            color: string;

            constructor(width: number, height: number) {
                this.x = Math.random() * width;
                this.y = Math.random() * height - height;
                this.speed = Math.random() * 4 + 2; // Much faster base speed
                this.length = Math.random() * 120 + 40; // Longer tails
                this.thickness = Math.random() * 3 + 1; // Thicker core
                this.opacity = Math.random() * 0.6 + 0.3; // Much brighter base
                this.resetY = height;

                // Assign a bright warm white color
                this.color = '255, 250, 235';
            }

            draw(ctx: CanvasRenderingContext2D, bassData: number) {
                // Reactive part: significantly boosted to feel fast and 60fps smooth
                const reactiveSpeed = this.speed + (bassData * 35);
                const reactiveOpacity = Math.min(this.opacity + (bassData * 1.5), 1);
                const reactiveLength = this.length + (bassData * 150);

                this.y += reactiveSpeed;
                this.x -= reactiveSpeed * 0.3; // Angular fall (falling down and left)

                // Reset when offscreen
                if (this.y > this.resetY + reactiveLength || this.x < -reactiveLength) {
                    this.x = Math.random() * ctx.canvas.width + ctx.canvas.width * 0.3; // spawn a bit to the right to account for leftward fall
                    this.y = -reactiveLength;
                }

                ctx.beginPath();
                const gradient = ctx.createLinearGradient(this.x, this.y, this.x + reactiveLength * 0.3, this.y - reactiveLength);
                gradient.addColorStop(0, `rgba(${this.color}, ${reactiveOpacity})`);
                gradient.addColorStop(1, `rgba(${this.color}, 0)`);

                ctx.strokeStyle = gradient;
                ctx.lineWidth = this.thickness + (bassData * 2);
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + reactiveLength * 0.3, this.y - reactiveLength);
                ctx.stroke();

                // Add a bright head
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.thickness + (bassData * 3), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${this.color}, ${reactiveOpacity})`;
                ctx.fill();
            }
        }

        const meteors: Meteor[] = Array.from({ length: 80 }, () => new Meteor(canvas!.width, canvas!.height));

        const render = () => {
            // Dark trailing effect
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Fetch generic audio data
            const audioDataArr = new Uint8Array(256);
            if (globalAnalyzer) {
                globalAnalyzer.getByteFrequencyData(audioDataArr);
            }
            let bassSum = 0;
            // Average the lower frequencies
            const bassRange = 10;
            for (let i = 0; i < bassRange; i++) {
                bassSum += audioDataArr[i] || 0;
            }
            // Normalize 0.0 to 1.0 (255 is max byte value)
            const normalizedBass = (bassSum / bassRange) / 255;

            meteors.forEach(m => m.draw(ctx, normalizedBass || 0));

            animationRef.current = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener('resize', resize);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none z-[-1] mix-blend-screen opacity-60"
        />
    );
};

export default MeteorShower;
