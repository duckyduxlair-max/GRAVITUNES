import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const Splash: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="fixed inset-0 bg-base flex flex-col items-center justify-center overflow-hidden z-50">
            {/* Ambient Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[150px]" />
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-linear-to-t from-base to-transparent" />
            </div>

            {/* Cinematic Vignette */}
            <div className="absolute inset-0 vignette pointer-events-none" />

            {/* Large Text Behind Vinyl (blurred, receding) */}
            <motion.div
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 0.06, scale: 1 }}
                transition={{ duration: 2, ease: 'easeOut' }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none select-none z-0"
            >
                <h1 className="text-[80px] md:text-[120px] font-black italic leading-[0.85] tracking-tighter text-white font-['Outfit'] blur-[2px]">
                    EXPLORE<br />YOUR<br />WORLD<br />OF<br />MUSIC
                </h1>
            </motion.div>

            {/* Vinyl / Gramophone */}
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.3, ease: [0.25, 1, 0.5, 1] }}
                className="relative z-10 flex flex-col items-center"
            >
                {/* Vinyl Disc */}
                <div className="relative w-56 h-56 md:w-72 md:h-72">
                    {/* Outer Disc */}
                    <div
                        className="absolute inset-0 rounded-full border-2 border-zinc-800"
                        style={{
                            background: 'conic-gradient(from 0deg, #1a1a1a, #2a2a2a, #1a1a1a, #252525, #1a1a1a)',
                            animation: 'vinyl-spin 8s linear infinite',
                        }}
                    >
                        {/* Grooves */}
                        {[...Array(6)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute rounded-full border border-white/3"
                                style={{
                                    inset: `${16 + i * 12}px`,
                                }}
                            />
                        ))}

                        {/* Center Label */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 md:w-24 md:h-24 rounded-full bg-linear-to-br from-accent via-accent/80 to-accent/60 flex items-center justify-center shadow-[0_0_30px_rgba(var(--accent-rgb),0.3)]">
                            <div className="w-4 h-4 rounded-full bg-base shadow-inner" />
                        </div>
                    </div>

                    {/* Tonearm */}
                    <div className="absolute -top-4 -right-2 md:-right-4 origin-top-right z-20">
                        <div className="w-1.5 h-28 md:h-36 bg-linear-to-b from-zinc-400 to-zinc-600 rounded-full transform rotate-[-25deg] shadow-lg">
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)]" />
                        </div>
                    </div>
                </div>

                {/* Soft Reflection */}
                <div className="w-48 md:w-64 h-16 mt-2 opacity-20 blur-md">
                    <div
                        className="w-full h-full rounded-full"
                        style={{
                            background: 'radial-gradient(ellipse, rgba(var(--accent-rgb),0.3), transparent 70%)',
                        }}
                    />
                </div>
            </motion.div>

            {/* Title Text */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.8 }}
                className="relative z-10 text-center mt-8 px-6"
            >
                <h2 className="text-3xl md:text-5xl font-black italic tracking-tight text-white font-['Outfit'] leading-tight">
                    EXPLORE YOUR<br />
                    <span className="gold-gradient-text glass-shine">WORLD OF MUSIC</span>
                </h2>
                <p className="text-zinc-500 text-sm md:text-base mt-3 tracking-wide">
                    Premium streaming experience
                </p>
            </motion.div>

            {/* Explore Now Button */}
            <motion.button
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.3 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/home')}
                className="relative z-10 mt-10 px-10 py-4 rounded-full text-black font-black text-lg tracking-widest font-['Outfit'] transition-all duration-500 glass-shine active:scale-95"
                style={{
                    background: `linear-gradient(to right, var(--accent), rgba(255,255,255,0.8), var(--accent))`,
                    boxShadow: `0 0 40px rgba(var(--accent-rgb), 0.4)`,
                }}
            >
                Explore Now
            </motion.button>
        </div>
    );
};

export default Splash;
