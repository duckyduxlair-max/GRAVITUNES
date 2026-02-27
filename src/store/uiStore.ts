import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SidebarPosition = 'left' | 'right';

interface UIState {
    isSidebarOpen: boolean;
    globalSearch: string;
    sidebarPosition: SidebarPosition;
    showPets: boolean;
    avatarUrl: string | null;
    theme: string;
    bgColor: string;
    setSidebarOpen: (isOpen: boolean) => void;
    toggleSidebar: () => void;
    setGlobalSearch: (query: string) => void;
    toggleSidebarPosition: () => void;
    togglePets: () => void;
    setAvatarUrl: (url: string | null) => void;
    setTheme: (themeId: string) => void;
    setBgColor: (color: string) => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            isSidebarOpen: false,
            globalSearch: '',
            sidebarPosition: 'right',
            showPets: true,
            avatarUrl: null,
            theme: 'gold',
            bgColor: '#0F0F0F',

            setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
            toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
            setGlobalSearch: (query) => set({ globalSearch: query }),
            toggleSidebarPosition: () => set((state) => ({ sidebarPosition: state.sidebarPosition === 'right' ? 'left' : 'right' })),
            togglePets: () => set((state) => ({ showPets: !state.showPets })),
            setAvatarUrl: (url) => set({ avatarUrl: url }),
            setTheme: (themeId) => set({ theme: themeId }),
            setBgColor: (color) => set({ bgColor: color }),
        }),
        {
            name: 'anti-gravity-ui-storage'
        }
    )
);
