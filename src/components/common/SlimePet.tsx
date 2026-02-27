import React, { useEffect, useRef, useState } from 'react';

type Emotion = 'normal' | 'happy' | 'angry' | 'fear' | 'crying' | 'peeking';

interface SlimePetProps {
    analyzer: AnalyserNode | null;
    isPlaying: boolean;
}

const SlimePet: React.FC<SlimePetProps> = ({ analyzer, isPlaying }) => {
    const petRef = useRef<HTMLDivElement>(null);

    const posRef = useRef({ x: window.innerWidth * 0.8, y: window.innerHeight * 0.8, vx: Math.random() > 0.5 ? 2 : -2, vy: -5 });
    const animRef = useRef({ scaleX: 1, scaleY: 1, rotation: 0, squishX: 1, squishY: 1 });
    const dragRef = useRef({ isDragging: false, offsetX: 0, offsetY: 0, startY: 0 });
    const behaviorRef = useRef({ mode: 'roam' as 'roam' | 'hiding', hideEdge: 1, hideTimer: 0 });

    const [emotion, setEmotion] = useState<Emotion>('normal');
    const [isBlinking, setIsBlinking] = useState(false);

    // Blinking trigger (only normal/happy)
    useEffect(() => {
        const blink = () => {
            if (emotion === 'normal' || emotion === 'happy') {
                setIsBlinking(true);
                setTimeout(() => setIsBlinking(false), 200);
            }
            setTimeout(blink, Math.random() * 4000 + 2000);
        };
        const timer = setTimeout(blink, 2000);
        return () => clearTimeout(timer);
    }, [emotion]);

    useEffect(() => {
        let frameId: number;
        const radius = 50;

        const handlePointerMove = (e: PointerEvent) => {
            if (!dragRef.current.isDragging) return;
            posRef.current.x = e.clientX - dragRef.current.offsetX;
            posRef.current.y = e.clientY - dragRef.current.offsetY;
            posRef.current.vx = e.movementX;
            posRef.current.vy = e.movementY;
        };

        const handlePointerUp = () => {
            if (!dragRef.current.isDragging) return;
            dragRef.current.isDragging = false;

            // Determine drop logic based on height
            if (emotion === 'fear') {
                // Dropped from high! Panic hide.
                setEmotion('crying');
                behaviorRef.current.mode = 'hiding';
                const goLeft = posRef.current.x < window.innerWidth / 2;
                posRef.current.vx = goLeft ? -15 : 15;
                posRef.current.vy = -2; // Hop on drop
                behaviorRef.current.hideEdge = goLeft ? -1 : 1;
            } else {
                // Gentle drop
                setEmotion(isPlaying ? 'happy' : 'normal');
            }
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        const update = () => {
            const pos = posRef.current;
            const anim = animRef.current;
            const drag = dragRef.current;
            const behavior = behaviorRef.current;
            const now = Date.now();

            let targetRot = 0;
            let targetScaleX = 1;
            let targetScaleY = 1;

            if (drag.isDragging) {
                // Suspended in air
                anim.squishX += (0.8 - anim.squishX) * 0.1; // elongate
                anim.squishY += (1.2 - anim.squishY) * 0.1;

                // Fear threshold (dragged high above center)
                if (pos.y < window.innerHeight * 0.4) {
                    setEmotion('fear');
                    targetRot = Math.sin(now / 30) * 15; // Shaking violently
                } else {
                    setEmotion('normal');
                    targetRot = pos.vx * 0.5; // swing naturally
                }
            } else {
                // Physics Simulation
                pos.x += pos.vx;
                pos.y += pos.vy;

                if (behavior.mode === 'roam') {
                    pos.vy += 0.4; // gravity
                    pos.vx *= 0.98; // friction

                    if (emotion !== 'angry' && Math.abs(pos.vx) < 2) {
                        pos.vx = pos.vx >= 0 ? 2 : -2; // min move speed
                    }
                    targetRot = pos.vx * 3;

                    // Walls
                    if (pos.x <= radius) {
                        pos.x = radius;
                        pos.vx = Math.abs(pos.vx * 0.8) + 1;
                        anim.squishX = 0.6; anim.squishY = 1.4;
                    } else if (pos.x >= window.innerWidth - radius) {
                        pos.x = window.innerWidth - radius;
                        pos.vx = -(Math.abs(pos.vx * 0.8) + 1);
                        anim.squishX = 0.6; anim.squishY = 1.4;
                    }

                    // Floor
                    if (pos.y >= window.innerHeight - radius) {
                        pos.y = window.innerHeight - radius;
                        if (pos.vy > 2) {
                            pos.vy = -pos.vy * 0.6;
                            anim.squishX = 1.4; anim.squishY = 0.6;
                        } else {
                            pos.vy = 0;
                        }
                    } else if (pos.y <= radius) {
                        pos.y = radius;
                        pos.vy = Math.abs(pos.vy);
                    }

                } else if (behavior.mode === 'hiding') {
                    // Running away in tears
                    pos.vy += 0.5; // high gravity
                    if (pos.y >= window.innerHeight - radius) {
                        pos.y = window.innerHeight - radius;
                        if (pos.vy > 2) pos.vy = -pos.vy * 0.4; else pos.vy = 0;
                    }

                    targetRot = pos.vx * 2;

                    // Hit the side to peek
                    const hitLeft = behavior.hideEdge === -1 && pos.x <= radius - 40; // bury into wall
                    const hitRight = behavior.hideEdge === 1 && pos.x >= window.innerWidth - radius + 40;

                    if (hitLeft || hitRight) {
                        pos.x = hitLeft ? radius - 40 : window.innerWidth - radius + 40;
                        pos.vx = 0;
                        setEmotion('peeking');
                        targetRot = 0;
                        targetScaleX = hitLeft ? 1 : -1; // face inside

                        // Timer to recover and come back
                        if (behavior.hideTimer === 0) {
                            behavior.hideTimer = now + 5000;
                        } else if (now > behavior.hideTimer) {
                            behavior.mode = 'roam';
                            setEmotion('normal');
                            pos.vx = hitLeft ? 5 : -5;
                            pos.vy = -5;
                            behavior.hideTimer = 0;
                        }
                    }
                }

                // Smooth squish recovery
                anim.squishX += (1 - anim.squishX) * 0.1;
                anim.squishY += (1 - anim.squishY) * 0.1;

                // Sync audio if roaming normally
                if (analyzer && isPlaying && behavior.mode === 'roam' && emotion !== 'fear' && emotion !== 'angry') {
                    if (emotion !== 'happy') setEmotion('happy');
                    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
                    analyzer.getByteFrequencyData(dataArray);

                    const bass = dataArray.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
                    const mids = dataArray.slice(10, 40).reduce((a, b) => a + b, 0) / 30;

                    const bassIntensity = bass / 255;
                    const midIntensity = mids / 255;

                    if (bassIntensity > 0.65) {
                        targetScaleY = 0.8 + (bassIntensity * 0.4);
                        targetScaleX = 1.2 - (bassIntensity * 0.2);
                        if (bassIntensity > 0.9 && pos.y >= window.innerHeight - radius - 10) {
                            pos.vy = - (Math.random() * 8 + 6);
                            anim.squishX = 0.5; anim.squishY = 1.5;
                        }
                    } else if (midIntensity > 0.4) {
                        targetRot += Math.sin(now / 150) * 25 * midIntensity;
                        if (pos.y >= window.innerHeight - radius - 5 && Math.random() > 0.9) pos.vy = -3;
                    }
                } else if (!drag.isDragging && behavior.mode === 'roam' && emotion !== 'angry') {
                    if (emotion !== 'normal') setEmotion('normal');
                    if (pos.y >= window.innerHeight - radius - 1) {
                        targetScaleY = 1 + Math.sin(now / 500) * 0.05;
                        targetScaleX = 1 + Math.cos(now / 500) * 0.03;
                    }
                }
            }

            if (emotion !== 'peeking') {
                targetScaleX *= (pos.vx >= 0 ? 1 : -1);
            }

            // Interpolate visually
            anim.scaleX += (targetScaleX * anim.squishX - anim.scaleX) * 0.2;
            anim.scaleY += (targetScaleY * anim.squishY - anim.scaleY) * 0.2;
            anim.rotation += (targetRot - anim.rotation) * 0.15;

            if (petRef.current) {
                petRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${anim.rotation}deg) scale(${anim.scaleX}, ${anim.scaleY})`;
            }

            frameId = requestAnimationFrame(update);
        };
        update();

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [analyzer, isPlaying, emotion]);

    const handlePointerDown = (e: React.PointerEvent) => {
        const rect = petRef.current?.getBoundingClientRect();
        if (rect && behaviorRef.current.mode === 'roam') {
            dragRef.current.isDragging = true;
            dragRef.current.offsetX = e.clientX - (rect.left + rect.width / 2);
            dragRef.current.offsetY = e.clientY - (rect.top + rect.height / 2);
            dragRef.current.startY = e.clientY;
            posRef.current.vx = 0; posRef.current.vy = 0;
            // Prevent text selection while dragging
            e.currentTarget.setPointerCapture(e.pointerId);
        }
    };

    const handleTap = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (Math.abs(e.clientY - dragRef.current.startY) > 10) return; // it was a drag
        if (behaviorRef.current.mode === 'roam' && emotion !== 'fear') {
            setEmotion('angry');
            posRef.current.vy = -12;
            posRef.current.vx = posRef.current.vx > 0 ? -15 : 15;
            animRef.current.squishX = 1.8;
            animRef.current.squishY = 0.4;
            setTimeout(() => setEmotion('normal'), 4000);
        }
    };

    const isAngryLike = emotion === 'angry' || emotion === 'crying' || emotion === 'peeking';
    const bodyColor = isAngryLike ? "#ff4d4d" : (emotion === 'fear' ? "#e6f2ff" : "#ff99bb");

    return (
        <div
            ref={petRef}
            onPointerDown={handlePointerDown}
            onClick={handleTap}
            className="fixed top-0 left-0 z-110 w-[100px] h-[100px] cursor-grab active:cursor-grabbing will-change-transform flex items-center justify-center transition-all group/pet drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] touch-none"
            style={{ transformOrigin: 'center center', marginLeft: '-50px', marginTop: '-50px' }}
            title="Music Slime! Drag me, tap me!"
        >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                {/* Main Body */}
                <path
                    d="M 50 20 C 85 20 95 50 95 75 C 95 95 75 95 50 95 C 25 95 5 95 5 75 C 5 50 15 20 50 20 Z"
                    fill={bodyColor}
                    stroke="#441122"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    className="transition-colors duration-300"
                />

                {/* Shake sweat line for fear */}
                {emotion === 'fear' && (
                    <g className="animate-pulse">
                        <path d="M 20 30 Q 15 40 20 45" stroke="#99ccff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                        <path d="M 80 30 Q 85 40 80 45" stroke="#99ccff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    </g>
                )}

                {/* Top Highlight */}
                {emotion !== 'fear' && <ellipse cx="30" cy="35" rx="14" ry="8" fill="white" opacity="0.4" transform="rotate(-20 30 35)" />}

                {/* Floating Bubbles / Music Notes */}
                <g className={isAngryLike || emotion === 'fear' ? "hidden" : "animate-pulse"}>
                    {emotion === 'happy' ? (
                        <>
                            <path d="M 85 15 L 85 25 A 3 3 0 1 1 82 28 L 85 28" fill="none" stroke="#441122" strokeWidth="1.5" strokeLinecap="round" />
                            <path d="M 85 15 L 90 12" fill="none" stroke="#441122" strokeWidth="1.5" strokeLinecap="round" />
                        </>
                    ) : (
                        <>
                            <circle cx="85" cy="20" r="6" fill="#ff99bb" stroke="#441122" strokeWidth="1.5" />
                            <ellipse cx="83" cy="18" rx="2" ry="1" fill="white" opacity="0.8" transform="rotate(-30 83 18)" />
                        </>
                    )}
                </g>

                {/* Angry FX (vein pop) */}
                {isAngryLike && (
                    <g transform="translate(75, 25) scale(0.6)">
                        <path d="M 0 10 L 10 0 L 20 10 L 10 20 Z" stroke="#cc0000" strokeWidth="3" fill="none" />
                        <line x1="10" y1="0" x2="10" y2="20" stroke="#cc0000" strokeWidth="3" />
                        <line x1="0" y1="10" x2="20" y2="10" stroke="#cc0000" strokeWidth="3" />
                    </g>
                )}

                {/* Tears for crying / peeking */}
                {(emotion === 'crying' || emotion === 'peeking') && (
                    <g className="animate-[bounce_0.5s_infinite]">
                        {/* Eye tears waterfall */}
                        <path d="M 28 68 Q 28 85 25 90 Q 30 95 32 90 Q 35 85 28 68" fill="#99ccff" opacity="0.8" />
                        <path d="M 62 68 Q 62 85 59 90 Q 64 95 66 90 Q 69 85 62 68" fill="#99ccff" opacity="0.8" />
                    </g>
                )}

                {/* Eyes Group */}
                <g>
                    {/* Left Eye */}
                    <g transform="translate(28, 65)">
                        <g id="slime-eye-left" style={{ transformOrigin: 'center center' }}>
                            {emotion === 'fear' ? (
                                <>
                                    <circle cx="0" cy="0" r="7" fill="white" stroke="#441122" strokeWidth="1.5" />
                                    <circle cx="0" cy="0" r="1.5" fill="#441122" />
                                </>
                            ) : isAngryLike ? (
                                <>
                                    <ellipse cx="0" cy="0" rx="4" ry="1" fill="#441122" />
                                    <line x1="-8" y1="-8" x2="6" y2="-2" stroke="#441122" strokeWidth="2.5" strokeLinecap="round" />
                                </>
                            ) : isBlinking ? (
                                <path d="M -4 2 Q 0 -4 4 2" stroke="#441122" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                            ) : (
                                <>
                                    <ellipse cx="0" cy="0" rx="4" ry="4" fill="#441122" />
                                    <ellipse cx="-1" cy="-1" rx="1" ry="1" fill="white" />
                                </>
                            )}
                        </g>
                    </g>

                    {/* Right Eye */}
                    <g transform="translate(62, 65)">
                        <g id="slime-eye-right" style={{ transformOrigin: 'center center' }}>
                            {emotion === 'fear' ? (
                                <>
                                    <circle cx="0" cy="0" r="7" fill="white" stroke="#441122" strokeWidth="1.5" />
                                    <circle cx="0" cy="0" r="1.5" fill="#441122" />
                                </>
                            ) : isAngryLike ? (
                                <>
                                    <ellipse cx="0" cy="0" rx="4" ry="1" fill="#441122" />
                                    <line x1="8" y1="-8" x2="-6" y2="-2" stroke="#441122" strokeWidth="2.5" strokeLinecap="round" />
                                </>
                            ) : isBlinking ? (
                                <path d="M -4 2 Q 0 -4 4 2" stroke="#441122" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                            ) : (
                                <>
                                    <ellipse cx="0" cy="0" rx="4" ry="4" fill="#441122" />
                                    <ellipse cx="-1" cy="-1" rx="1" ry="1" fill="white" />
                                </>
                            )}
                        </g>
                    </g>
                </g>

                {/* Mouth Group */}
                <g transform="translate(0, 0)">
                    {emotion === 'fear' ? (
                        <ellipse cx="45" cy="76" rx="3" ry="5" fill="#441122" />
                    ) : isAngryLike ? (
                        <path d="M 38 78 L 43 75 L 47 78 L 52 75 L 56 78" stroke="#441122" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    ) : emotion === 'happy' ? (
                        <path d="M 38 74 Q 45 84 52 74 Z" fill="#441122" />
                    ) : (
                        <path d="M 38 74 Q 41.5 80 45 76 Q 48.5 80 52 74" stroke="#441122" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                </g>

                {/* Blush */}
                {(emotion === 'normal' || emotion === 'happy' || emotion === 'fear') && (
                    <g opacity="0.4">
                        <ellipse cx="18" cy="68" rx="5" ry="3" fill="#ff4477" />
                        <ellipse cx="72" cy="68" rx="5" ry="3" fill="#ff4477" />
                    </g>
                )}
            </svg>
        </div>
    );
};

export default SlimePet;
