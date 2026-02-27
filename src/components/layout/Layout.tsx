import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import BottomPlayer from './BottomPlayer';
import PlayerModal from './PlayerModal';
import RightSidebar from './RightSidebar';
import MobileDock from './MobileDock';
import { useUIStore } from '../../store/uiStore';
import { Menu, Search } from 'lucide-react';

const Layout: React.FC = () => {
    const toggleSidebar = useUIStore((state) => state.toggleSidebar);
    const location = useLocation();
    const navigate = useNavigate();

    // Don't show layout chrome on splash screen
    const isSplash = location.pathname === '/';

    if (isSplash) {
        return <Outlet />;
    }

    return (
        <div className="flex h-dvh w-full relative bg-mesh overflow-hidden">
            {/* Ambient glow background */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/3 rounded-full blur-[150px]" />
                <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent/2 rounded-full blur-[120px]" />
            </div>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 w-full px-5 py-4 z-150 flex justify-between items-center"
                style={{ background: 'linear-gradient(to bottom, var(--bg-base, #0F0F0F) 60%, transparent)' }}>
                <div className="flex flex-col shrink-0 min-w-0">
                    <div className="flex items-center gap-2">
                        {/* GTM Logo */}
                        <span className="relative inline-block overflow-visible text-sm font-black italic tracking-tight text-transparent bg-clip-text bg-linear-to-r from-accent/60 via-accent to-accent/60 animate-gtm-shine bg-size-[200%_auto] leading-none drop-shadow-[0_0_6px_rgba(var(--accent-rgb),0.3)] glass-shine" style={{ WebkitTextFillColor: 'transparent' }}>GTM</span>
                        <div className="flex flex-col">
                            <h1 className="relative inline-block overflow-visible text-[18px] font-black italic tracking-widest text-white leading-none font-['Outfit'] glass-shine">Gravi<span className="text-accent">Tunes</span></h1>
                            <h1 className="text-[9px] font-bold tracking-[0.15em] text-zinc-500 mt-0.5 leading-none font-['Outfit'] uppercase">By Manasvi & Mayank</h1>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate('/search')}
                        className="p-3 rounded-2xl text-zinc-400 hover:text-white transition-colors"
                        aria-label="Search"
                    >
                        <Search size={20} />
                    </button>
                    <button
                        onClick={() => toggleSidebar()}
                        className="p-3 glass-panel rounded-2xl text-zinc-400 hover:text-white active:scale-95 transition-all relative z-200"
                        aria-label="Toggle Menu"
                    >
                        <Menu size={20} />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 h-full overflow-hidden flex flex-col relative z-10 transition-all duration-300 ease-in-out">
                <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-18 md:pt-8 pb-52 md:pb-36 h-full">
                    <AnimatePresence mode="wait">
                        <React.Fragment key={location.pathname}>
                            <Outlet />
                        </React.Fragment>
                    </AnimatePresence>
                </div>
            </main>

            {/* Bottom Player */}
            <div className={`fixed bottom-18 md:bottom-6 left-3 right-3 md:left-8 md:right-8 z-100 ${location.pathname === '/now-playing' ? 'hidden' : ''}`}>
                <BottomPlayer />
            </div>

            {/* Right Sidebar */}
            <RightSidebar />

            {/* Mobile Bottom Dock */}
            <MobileDock />

            <PlayerModal />
        </div>
    );
};

export default Layout;
