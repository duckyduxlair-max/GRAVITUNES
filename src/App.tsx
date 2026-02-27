import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Library from './pages/Library';
import Playlists from './pages/Playlists.tsx';
import Import from './pages/Import';
import React, { useEffect } from 'react';
import Search from './pages/Search';
import Settings from './pages/Settings';
import ThemeSettings from './pages/ThemeSettings.tsx';
import NowPlaying from './pages/NowPlaying';
import Splash from './pages/Splash.tsx';
import { registerSW } from 'virtual:pwa-register';
import { pruneUnusedAudio } from './services/db';
import { useLibraryStore } from './store/libraryStore';
import ThemeProvider from './components/ThemeProvider';
import AudioController from './components/player/AudioController';
import Home from './pages/Home.tsx';

const App: React.FC = () => {
  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        console.log('New content available, please refresh.');
      },
      onOfflineReady() {
        console.log('App ready to work offline');
      },
    });

    // Run cache cleanup on mount
    const cleanupCache = async () => {
      const activeSongs = useLibraryStore.getState().songs;
      const activeIds = Object.keys(activeSongs);
      await pruneUnusedAudio(activeIds);
    };
    cleanupCache();

    return () => { updateSW(); };
  }, []);

  return (
    <ThemeProvider>
      <AudioController />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Splash />} />
            <Route path="home" element={<Home />} />
            <Route path="library" element={<Library />} />
            <Route path="playlists" element={<Playlists />} />
            <Route path="import" element={<Import />} />
            <Route path="search" element={<Search />} />
            <Route path="now-playing" element={<NowPlaying />} />
            <Route path="settings" element={<Settings />} />
            <Route path="settings/theme" element={<ThemeSettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
