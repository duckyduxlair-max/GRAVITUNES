import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Library, Search, Home, ListMusic, DownloadCloud, Settings } from 'lucide-react';

const MobileDock: React.FC = () => {
    const location = useLocation();

    const navLinks = [
        { to: "/home", icon: Home, label: "Home" },
        { to: "/search", icon: Search, label: "Search" },
        { to: "/library", icon: Library, label: "Library" },
        { to: "/playlists", icon: ListMusic, label: "Lists" },
        { to: "/import", icon: DownloadCloud, label: "Import" },
        { to: "/settings", icon: Settings, label: "Settings" },
    ];

    // Hide on splash and now-playing
    if (location.pathname === '/' || location.pathname === '/now-playing') return null;

    // Find the active index for the golden ball position
    const activeIndex = navLinks.findIndex(l => location.pathname.startsWith(l.to));

    return (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-110 pointer-events-none">
            {/* SVG curve cutout background */}
            <nav className="pointer-events-auto relative mx-0">
                {/* The dock bar */}
                <div className="relative">
                    {/* SVG with curve notch */}
                    <svg
                        className="absolute bottom-0 left-0 w-full"
                        height="70"
                        viewBox="0 0 600 70"
                        preserveAspectRatio="none"
                        fill="none"
                    >
                        <defs>
                            <filter id="dock-shadow" x="-4%" y="-20%" width="108%" height="140%">
                                <feDropShadow dx="0" dy="-4" stdDeviation="6" floodColor="rgba(0,0,0,0.4)" />
                            </filter>
                        </defs>
                        {activeIndex >= 0 ? (
                            <path
                                d={generateCurvePath(activeIndex, navLinks.length)}
                                fill="rgba(15,15,15,0.95)"
                                filter="url(#dock-shadow)"
                                style={{ transition: 'd 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                            />
                        ) : (
                            <rect x="0" y="0" width="600" height="70" rx="0" fill="rgba(15,15,15,0.95)" filter="url(#dock-shadow)" />
                        )}
                    </svg>

                    {/* Liquid blob SVG filter */}
                    <svg className="absolute w-0 h-0">
                        <defs>
                            <filter id="liquid-blob">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                                <feColorMatrix in="blur" mode="matrix"
                                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"
                                    result="blob" />
                                <feComposite in="SourceGraphic" in2="blob" operator="atop" />
                            </filter>
                        </defs>
                    </svg>

                    {/* Golden floating ball with liquid morph */}
                    {activeIndex >= 0 && (
                        <div
                            className="absolute z-20 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                            style={{
                                left: `${((activeIndex + 0.5) / navLinks.length) * 100}%`,
                                top: '-14px',
                                transform: 'translateX(-50%)',
                                filter: 'url(#liquid-blob)',
                            }}
                        >
                            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center shadow-[0_0_20px_rgba(var(--accent-rgb),0.5),0_4px_16px_rgba(0,0,0,0.4)]">
                                {React.createElement(navLinks[activeIndex].icon, { size: 20, className: 'text-black', strokeWidth: 2.5 })}
                            </div>
                        </div>
                    )}

                    {/* Nav items */}
                    <div className="relative z-10 flex items-end justify-around h-[70px] pb-3 pt-5 px-1">
                        {navLinks.map((link) => {
                            const isActive = location.pathname.startsWith(link.to);
                            return (
                                <NavLink
                                    key={link.to}
                                    to={link.to}
                                    className="flex flex-col items-center justify-end gap-0.5 relative flex-1"
                                >
                                    <div
                                        className={`transition-all duration-300 ${isActive ? 'opacity-0 -translate-y-3' : 'opacity-70'}`}
                                    >
                                        {React.createElement(link.icon, { size: 18, className: isActive ? 'text-accent' : 'text-zinc-500' })}
                                    </div>
                                    <span className={`text-[9px] font-semibold tracking-wide transition-all duration-300 ${isActive ? 'text-accent translate-y-0' : 'text-zinc-600'}`}>
                                        {link.label}
                                    </span>
                                </NavLink>
                            );
                        })}
                    </div>
                </div>
            </nav>
        </div>
    );
};

/** Generate SVG path with a curved notch at the active tab position */
function generateCurvePath(activeIdx: number, totalTabs: number): string {
    const width = 600;
    const height = 70;
    const tabWidth = width / totalTabs;
    const centerX = tabWidth * activeIdx + tabWidth / 2;
    const notchRadius = 32;
    const notchDepth = 22;

    const startX = centerX - notchRadius - 8;
    const endX = centerX + notchRadius + 8;

    return [
        `M0,${height}`,
        `V12`,
        `H${startX}`,
        `C${startX + 12},12 ${centerX - notchRadius - 2},${-notchDepth} ${centerX},${-notchDepth}`,
        `C${centerX + notchRadius + 2},${-notchDepth} ${endX - 12},12 ${endX},12`,
        `H${width}`,
        `V${height}`,
        `Z`
    ].join(' ');
}

export default MobileDock;
