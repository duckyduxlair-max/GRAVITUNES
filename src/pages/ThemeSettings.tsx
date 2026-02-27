import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Sun, Moon, Palette, Paintbrush } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import { useUIStore } from '../store/uiStore';
import { THEMES, BG_PRESETS } from '../components/ThemeProvider';

const ThemeSettings: React.FC = () => {
    const navigate = useNavigate();
    const { theme, setTheme, bgColor, setBgColor } = useUIStore();

    // Accent categories
    const goldVariants = THEMES.slice(0, 8);
    const regalHues = THEMES.slice(8, 13);
    const neutrals = THEMES.slice(13, 18);
    const distinctive = THEMES.slice(18);

    // BG categories
    const darkBgs = BG_PRESETS.filter(b => {
        const r = parseInt(b.color.slice(1, 3), 16);
        const g = parseInt(b.color.slice(3, 5), 16);
        const bl = parseInt(b.color.slice(5, 7), 16);
        return (0.299 * r + 0.587 * g + 0.114 * bl) / 255 <= 0.5;
    });
    const lightBgs = BG_PRESETS.filter(b => {
        const r = parseInt(b.color.slice(1, 3), 16);
        const g = parseInt(b.color.slice(3, 5), 16);
        const bl = parseInt(b.color.slice(5, 7), 16);
        return (0.299 * r + 0.587 * g + 0.114 * bl) / 255 > 0.5;
    });

    const ColorSwatch = ({ color, name, isActive, onClick }: { color: string; name: string; isActive: boolean; onClick: () => void }) => (
        <button
            onClick={onClick}
            className={`relative rounded-xl overflow-hidden transition-all group ${isActive ? 'ring-2 ring-accent ring-offset-2 ring-offset-base scale-105' : 'opacity-80 hover:opacity-100 hover:scale-[1.02]'}`}
        >
            <div
                className="w-full aspect-square rounded-xl border border-white/10"
                style={{ backgroundColor: color }}
            />
            <span className="block text-[10px] font-medium text-zinc-400 mt-1.5 truncate text-center px-1">{name}</span>
            {isActive && (
                <div className="absolute top-1 right-1 bg-accent rounded-full p-0.5">
                    <Check size={10} className="text-black" />
                </div>
            )}
        </button>
    );

    const AccentCard = ({ name, color, isActive, onClick }: { id: string; name: string; color: string; isActive: boolean; onClick: () => void }) => (
        <button
            onClick={onClick}
            className={`relative rounded-2xl overflow-hidden aspect-video transition-all group ${isActive ? 'ring-2 ring-accent ring-offset-2 ring-offset-base' : 'opacity-80 hover:opacity-100 hover:scale-[1.02]'}`}
        >
            <div
                className="absolute inset-0 w-full h-full"
                style={{
                    background: `linear-gradient(135deg, ${bgColor} 0%, ${bgColor} 50%, ${color}33 100%)`
                }}
            />
            <div
                className="absolute top-4 left-4 w-6 h-6 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-white/20"
                style={{ backgroundColor: color }}
            />
            <span className="absolute bottom-4 left-4 text-sm font-semibold text-white drop-shadow-md">{name}</span>
            {isActive && (
                <div className="absolute top-4 right-4 text-accent drop-shadow-md bg-white/10 rounded-full p-1 backdrop-blur-md">
                    <Check size={14} className="text-white" />
                </div>
            )}
        </button>
    );

    return (
        <PageTransition>
            <div className="max-w-4xl mx-auto pb-32">
                {/* Header */}
                <div className="sticky top-0 z-20 bg-base/80 backdrop-blur-xl border-b border-white/5 py-6 mb-8 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/settings')}
                            className="p-2 rounded-full hover:bg-white/5 transition-colors"
                        >
                            <ArrowLeft size={24} className="text-zinc-400" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black italic tracking-tighter text-white font-['Outfit'] leading-none">
                                Appearance
                            </h1>
                            <p className="text-zinc-500 text-sm tracking-wide mt-1">Customize background & accent colors</p>
                        </div>
                    </div>
                </div>

                <div className="animate-fade-in space-y-10">
                    {/* ══════ BACKGROUND SECTION ══════ */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                                <Paintbrush size={18} className="text-zinc-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white font-['Outfit']">Background</h2>
                                <p className="text-zinc-600 text-xs">Sets the entire app background color</p>
                            </div>
                        </div>

                        {/* Dark backgrounds */}
                        <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-500 uppercase mb-3 flex items-center gap-2">
                            <Moon size={12} /> Dark Themes
                        </h3>
                        <div className="grid grid-cols-5 sm:grid-cols-7 gap-3 mb-6">
                            {darkBgs.map(bg => (
                                <ColorSwatch
                                    key={bg.id}
                                    color={bg.color}
                                    name={bg.name}
                                    isActive={bgColor === bg.color}
                                    onClick={() => setBgColor(bg.color)}
                                />
                            ))}
                        </div>

                        {/* Light backgrounds */}
                        <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-500 uppercase mb-3 flex items-center gap-2">
                            <Sun size={12} /> Light Themes
                        </h3>
                        <div className="grid grid-cols-5 sm:grid-cols-7 gap-3">
                            {lightBgs.map(bg => (
                                <ColorSwatch
                                    key={bg.id}
                                    color={bg.color}
                                    name={bg.name}
                                    isActive={bgColor === bg.color}
                                    onClick={() => setBgColor(bg.color)}
                                />
                            ))}
                        </div>
                    </section>

                    <div className="h-px bg-white/5" />

                    {/* ══════ ACCENT COLOR SECTION ══════ */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                                <Palette size={18} className="text-accent" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white font-['Outfit']">Accent Color</h2>
                                <p className="text-zinc-600 text-xs">Controls buttons, highlights & assets</p>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div>
                                <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-500 uppercase mb-3">Prestige Golds</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {goldVariants.map(t => (
                                        <AccentCard key={t.id} {...t} isActive={theme === t.id} onClick={() => setTheme(t.id)} />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-500 uppercase mb-3">Deep & Regal Hues</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {regalHues.map(t => (
                                        <AccentCard key={t.id} {...t} isActive={theme === t.id} onClick={() => setTheme(t.id)} />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-500 uppercase mb-3">Old Money Neutrals</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {neutrals.map(t => (
                                        <AccentCard key={t.id} {...t} isActive={theme === t.id} onClick={() => setTheme(t.id)} />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-500 uppercase mb-3">Sophisticated & Distinct</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                    {distinctive.map(t => (
                                        <AccentCard key={t.id} {...t} isActive={theme === t.id} onClick={() => setTheme(t.id)} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </PageTransition>
    );
};

export default ThemeSettings;
