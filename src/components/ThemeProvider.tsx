import React, { useEffect } from 'react';
import { useUIStore } from '../store/uiStore';

// Accent color presets (for accents & assets)
export const THEMES = [
    // Default & Gold Variants
    { id: 'gold', name: 'Gold Luxury', color: '#D4AF37' },
    { id: 'champagne', name: 'Champagne Gold', color: '#F7E7CE' },
    { id: 'rose', name: 'Rose Gold', color: '#B76E79' },
    { id: 'bronze', name: 'Bronze Coin', color: '#A57D02' },
    { id: 'chinese', name: 'Chinese Gold', color: '#CD9900' },
    { id: 'mecca', name: 'Mecca Gold', color: '#D4AF37' },
    { id: 'gilded', name: 'Gilded', color: '#FFD700' },
    { id: 'neon_yellow', name: 'Neon Yellow', color: '#FBBF24' },

    // Deep & Regal Hues
    { id: 'emerald', name: 'Emerald Green', color: '#50C878' },
    { id: 'royal_blue', name: 'Royal Blue', color: '#4169E1' },
    { id: 'burgundy', name: 'Burgundy', color: '#800020' },
    { id: 'plum', name: 'Majestic Plum', color: '#8E4585' },
    { id: 'onyx', name: 'Onyx White', color: '#FFFFFF' },

    // Soft & Neutrals
    { id: 'ecru', name: 'Ecru', color: '#C2B280' },
    { id: 'taupe', name: 'Taupe Brown', color: '#C6AC8E' },
    { id: 'creamy', name: 'Creamy White', color: '#EAE0D5' },
    { id: 'camel', name: 'Camel', color: '#C19A6B' },
    { id: 'ivory', name: 'Ivory', color: '#FFFFF0' },

    // Distinctive
    { id: 'saffron', name: 'Saffron', color: '#F4C430' },
    { id: 'charcoal', name: 'Charcoal Gray', color: '#E0E0E0' },
    { id: 'magenta', name: 'Magenta', color: '#FF00FF' },
    { id: 'amber', name: 'Amber', color: '#FFBF00' },
    { id: 'crimson', name: 'Crimson Red', color: '#DC143C' }
];

// Background color presets (for whole app background)
export const BG_PRESETS = [
    { id: 'pitch_black', name: 'Pitch Black', color: '#000000' },
    { id: 'deep_dark', name: 'Deep Dark', color: '#050505' },
    { id: 'default_dark', name: 'Default Dark', color: '#0F0F0F' },
    { id: 'charcoal', name: 'Charcoal', color: '#1A1A1A' },
    { id: 'graphite', name: 'Graphite', color: '#1C1C1C' },
    { id: 'slate', name: 'Dark Slate', color: '#1E2028' },
    { id: 'navy', name: 'Navy Dark', color: '#0A0E1A' },
    { id: 'forest', name: 'Forest Dark', color: '#0A120A' },
    { id: 'wine', name: 'Wine Dark', color: '#1A0006' },
    { id: 'plum_bg', name: 'Plum Dark', color: '#100512' },
    { id: 'warm_dark', name: 'Warm Dark', color: '#171411' },
    { id: 'light_gray', name: 'Light Gray', color: '#E8E8E8' },
    { id: 'pure_white', name: 'Pure White', color: '#F5F5F5' },
    { id: 'cream', name: 'Cream', color: '#FAF0E6' },
];

export const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '212, 175, 55';
};

// Determine if a hex color is "light" 
const isLightColor = (hex: string): boolean => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return false;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
};

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { theme, bgColor } = useUIStore();

    useEffect(() => {
        const activeTheme = THEMES.find(t => t.id === theme) || THEMES[0];
        const root = document.documentElement;

        // Accent color (for assets & UI accents)
        root.style.setProperty('--accent', activeTheme.color);
        root.style.setProperty('--accent-rgb', hexToRgb(activeTheme.color));

        // Background color (independent of accent)
        root.style.setProperty('--bg-base', bgColor);
        root.style.setProperty('--bg-base-rgb', hexToRgb(bgColor));

        // Adjust text colors based on background luminance
        const lightBg = isLightColor(bgColor);
        root.style.setProperty('--text-adapt', lightBg ? '#1A1A1A' : '#F5F5F5');
        root.style.setProperty('--text-adapt-secondary', lightBg ? '#555555' : '#8A8A8A');

        // Update theme-color meta tag  
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', bgColor);
        }

        // Set data-theme for CSS light mode overrides
        root.setAttribute('data-theme', lightBg ? 'light' : 'dark');
    }, [theme, bgColor]);

    return <>{children}</>;
};

export default ThemeProvider;
