import React, { useEffect, useRef } from 'react';

const AntiGravityParticles: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let particles: Particle[] = [];

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initParticles();
        };

        class Particle {
            x: number;
            y: number;
            size: number;
            speedY: number;
            speedX: number;
            opacity: number;
            color: string;
            wobble: number;
            wobbleSpeed: number;

            constructor() {
                this.x = Math.random() * window.innerWidth;
                this.y = Math.random() * window.innerHeight;
                this.size = Math.random() * 2.5 + 0.5;
                // Soft drift upwards (anti-gravity)
                this.speedY = -(Math.random() * 0.4 + 0.1);
                this.speedX = (Math.random() - 0.5) * 0.2;
                this.opacity = Math.random() * 0.5 + 0.1;
                this.color = Math.random() > 0.5 ? '255,255,255' : '147,197,253'; // White or light blue
                this.wobble = Math.random() * Math.PI * 2;
                this.wobbleSpeed = Math.random() * 0.02 + 0.01;
            }

            update() {
                this.y += this.speedY;
                // Add soft horizontal parallax wobble
                this.wobble += this.wobbleSpeed;
                this.x += Math.sin(this.wobble) * 0.3 + this.speedX;

                if (this.y < -10) {
                    this.y = window.innerHeight + 10;
                    this.x = Math.random() * window.innerWidth;
                }
                if (this.x < -10) this.x = window.innerWidth + 10;
                if (this.x > window.innerWidth + 10) this.x = -10;
            }

            draw() {
                if (!ctx) return;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${this.color}, ${this.opacity})`;
                ctx.fill();

                // Add a subtle glow to larger particles
                if (this.size > 1.5) {
                    const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 3);
                    gradient.addColorStop(0, `rgba(${this.color}, ${this.opacity * 0.5})`);
                    gradient.addColorStop(1, 'rgba(255,255,255, 0)');
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        const initParticles = () => {
            particles = [];
            const particleCount = Math.floor((window.innerWidth * window.innerHeight) / 15000); // Responsive amount
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        };

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            animationFrameId = requestAnimationFrame(animate);
        };

        window.addEventListener('resize', resize);
        resize();
        animate();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-0 mix-blend-screen opacity-60"
        />
    );
};

export default AntiGravityParticles;
