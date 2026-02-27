import React, { useState, useEffect, useRef } from 'react';
import { Mic } from 'lucide-react';
import { eventBus, Events } from '../services/eventBus';

interface PopupData {
    text: string;
    type: 'greeting' | 'command' | 'error' | 'info';
}

const GraviPopup: React.FC = () => {
    const [popup, setPopup] = useState<PopupData | null>(null);
    const [visible, setVisible] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const unsub = eventBus.on(Events.GRAVI_POPUP, (data: PopupData) => {
            if (timerRef.current) clearTimeout(timerRef.current);
            setPopup(data);
            setVisible(true);
            timerRef.current = setTimeout(() => {
                setVisible(false);
                setTimeout(() => setPopup(null), 400);
            }, 2500);
        });
        return () => { unsub(); if (timerRef.current) clearTimeout(timerRef.current); };
    }, []);

    if (!popup) return null;

    const colors: Record<string, string> = {
        greeting: 'from-accent/90 to-accent/60',
        command: 'from-green-500/80 to-green-600/60',
        error: 'from-red-500/80 to-red-600/60',
        info: 'from-zinc-600/80 to-zinc-700/60',
    };

    return (
        <div
            className={`fixed top-16 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300
                ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}
        >
            <div className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r ${colors[popup.type] || colors.info}
                backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/10`}
            >
                <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                    <Mic size={14} className="text-white" />
                </div>
                <div>
                    <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Gravi</p>
                    <p className="text-white text-sm font-medium">{popup.text}</p>
                </div>
            </div>
        </div>
    );
};

export default GraviPopup;
