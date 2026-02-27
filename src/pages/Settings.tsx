import React, { useRef, useEffect, useState } from 'react';
import { Trash2, Palette, ChevronRight, HardDrive, RefreshCw, Upload, Shield, RotateCcw, Sparkles, Download, Moon, Archive, CheckCircle, XCircle, AlertCircle, Loader2, Headphones, Type } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { clearAllAudio, getStorageStats } from '../services/db';
import PageTransition from '../components/layout/PageTransition';
import { usePlayerStore } from '../store/playerStore';
import { useNavigate } from 'react-router-dom';
import { THEMES } from '../components/ThemeProvider';
import { useDownloadStore } from '../store/downloadStore';
import { exportLibraryBackup, importLibraryBackup } from '../services/backupService';
import { startSleepTimer as globalStartSleep, cancelSleepTimer as globalCancelSleep, getSleepState, onSleepChange } from '../services/sleepTimer';
import { setPreset, getPreset, getAvailablePresets } from '../services/audioEnhancement';

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatSleepTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const Settings: React.FC = () => {
    const { showPets, togglePets, avatarUrl, setAvatarUrl, theme } = useUIStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [storageBytes, setStorageBytes] = useState(0);
    const [fileCount, setFileCount] = useState(0);
    const [loadingStorage, setLoadingStorage] = useState(true);
    const navigate = useNavigate();
    const { downloads, clearHistory: clearDownloadHistory } = useDownloadStore();
    const backupInputRef = useRef<HTMLInputElement>(null);
    const [backupStatus, setBackupStatus] = useState<string | null>(null);
    const [activePreset, setActivePreset] = useState(() => getPreset());

    // ─── Sleep Timer (global — persists across tabs) ───
    const [sleepState, setSleepState] = useState(getSleepState());
    const [customMinutes, setCustomMinutes] = useState('');

    useEffect(() => {
        const unsub = onSleepChange(() => setSleepState(getSleepState()));
        return unsub;
    }, []);

    const sleepMinutes = sleepState.minutes;
    const sleepRemaining = sleepState.remaining;
    const startSleepTimer = (min: number) => globalStartSleep(min);
    const cancelSleepTimer = () => globalCancelSleep();

    // Light text toggle
    const [lightText, setLightText] = useState(() => document.documentElement.getAttribute('data-theme') === 'light');
    const toggleLightText = () => {
        const newVal = !lightText;
        setLightText(newVal);
        document.documentElement.setAttribute('data-theme', newVal ? 'light' : 'dark');
        localStorage.setItem('gravitunes_text_theme', newVal ? 'light' : 'dark');
    };

    const formatSleepTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // ─── Backup ───
    const handleExport = async () => {
        setBackupStatus('Exporting...');
        try {
            await exportLibraryBackup();
            setBackupStatus('✅ Backup downloaded!');
        } catch { setBackupStatus('❌ Export failed.'); }
        setTimeout(() => setBackupStatus(null), 3000);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBackupStatus('Importing...');
        const result = await importLibraryBackup(file);
        if (result.success) {
            setBackupStatus(`✅ Imported ${result.imported} songs (${result.skipped} skipped)`);
        } else {
            setBackupStatus(`❌ ${result.error}`);
        }
        setTimeout(() => setBackupStatus(null), 4000);
    };

    const fetchStorage = async () => {
        setLoadingStorage(true);
        try {
            const stats = await getStorageStats();
            setStorageBytes(stats.totalBytes);
            setFileCount(stats.fileCount);
        } catch { /* ignore */ }
        setLoadingStorage(false);
    };

    useEffect(() => { fetchStorage(); }, []);

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setAvatarUrl(ev.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleResetSettings = () => {
        if (confirm('Reset all preferences? Your music stays.')) {
            localStorage.removeItem('anti-gravity-ui-storage');
            localStorage.removeItem('anti-gravity-player-storage');
            window.location.reload();
        }
    };

    const handleDeleteAllData = async () => {
        if (confirm('⚠️ Delete ALL downloaded music and playlists? This cannot be undone.')) {
            try {
                await clearAllAudio();
                localStorage.removeItem('anti-gravity-library-storage');
                usePlayerStore.getState().clearQueue();
                window.location.reload();
            } catch (err) {
                console.error('Failed to clear data', err);
                alert('An error occurred.');
            }
        }
    };

    return (
        <PageTransition>
            <div className="w-full h-full flex flex-col pb-10 max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-1 h-8 rounded-full bg-accent" />
                        <h2 className="text-3xl font-black tracking-tight text-white font-['Outfit']">Settings</h2>
                    </div>
                    <p className="text-zinc-600 text-sm ml-4 pl-1">Customize your experience</p>
                </div>

                <div className="space-y-4">
                    {/* ─── Personalization ─── */}
                    <section className="glass-panel rounded-2xl p-5 space-y-5">
                        <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-500 uppercase">Personalization</h3>

                        <button
                            onClick={() => navigate('/settings/theme')}
                            className="w-full flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                                    <Palette size={16} className="text-accent" />
                                </div>
                                <div className="text-left">
                                    <p className="text-white font-medium text-sm">Theme Appearance</p>
                                    <p className="text-zinc-600 text-[11px] mt-0.5">Custom colors & luxury themes</p>
                                </div>
                            </div>
                            <ChevronRight size={16} className="text-zinc-600 group-hover:text-white transition-colors" />
                        </button>
                    </section>
                    {/* ─── Profile ─── */}
                    <section className="glass-panel rounded-2xl p-5 space-y-4">
                        <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-500 uppercase">Profile</h3>
                        <div className="flex items-center gap-4">
                            <div
                                className="relative w-16 h-16 rounded-2xl overflow-hidden border border-white/10 cursor-pointer group"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-accent/10 flex items-center justify-center">
                                        <Upload size={18} className="text-accent/60" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Upload size={16} className="text-white" />
                                </div>
                            </div>
                            <div className="flex-1">
                                <p className="text-white font-semibold text-sm">Profile Picture</p>
                                <p className="text-zinc-600 text-xs mt-0.5">Tap to upload your avatar</p>
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                        </div>
                    </section>

                    {/* ─── Playback ─── */}
                    <section className="glass-panel rounded-2xl p-5 space-y-5">
                        <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-500 uppercase">Playback</h3>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                                    <Sparkles size={16} className="text-accent" />
                                </div>
                                <div>
                                    <p className="text-white font-medium text-sm">Companion Pets</p>
                                    <p className="text-zinc-600 text-[11px] mt-0.5">Show SlimePet & MiniRobo</p>
                                </div>
                            </div>
                            <button
                                onClick={togglePets}
                                className={`relative w-11 h-6 rounded-full transition-all duration-300 ${showPets ? 'bg-accent' : 'bg-zinc-700'}`}
                            >
                                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${showPets ? 'left-[22px]' : 'left-0.5'}`} />
                            </button>
                        </div>
                    </section>

                    {/* ─── Storage Usage ─── */}
                    <section className="glass-panel rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-500 uppercase">Storage</h3>
                            <button
                                onClick={fetchStorage}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
                                title="Refresh"
                            >
                                <RefreshCw size={12} className={loadingStorage ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/15 flex items-center justify-center shrink-0">
                                <HardDrive size={22} className="text-accent" />
                            </div>
                            <div className="flex-1">
                                <p className="text-white font-bold text-lg font-mono tabular-nums">
                                    {loadingStorage ? '...' : formatBytes(storageBytes)}
                                </p>
                                <p className="text-zinc-600 text-xs mt-0.5">
                                    {loadingStorage ? 'Calculating...' : `${fileCount} audio file${fileCount !== 1 ? 's' : ''} stored in IndexedDB`}
                                </p>
                            </div>
                        </div>

                        {/* Storage bar visual */}
                        {!loadingStorage && storageBytes > 0 && (
                            <div className="space-y-1.5">
                                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-accent transition-all duration-500"
                                        style={{ width: `${Math.min((storageBytes / (500 * 1024 * 1024)) * 100, 100)}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-zinc-700 text-right">No storage limit • Unlimited downloads</p>
                            </div>
                        )}
                    </section>

                    {/* ─── Download History ─── */}
                    <section className="glass-panel rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-500 uppercase">Downloads</h3>
                            {downloads.length > 0 && (
                                <button
                                    onClick={clearDownloadHistory}
                                    className="text-[10px] text-zinc-600 hover:text-accent transition-colors font-bold uppercase tracking-wider"
                                >
                                    Clear History
                                </button>
                            )}
                        </div>

                        {downloads.length === 0 ? (
                            <div className="text-center py-6">
                                <Download size={24} className="mx-auto text-zinc-700 mb-2" />
                                <p className="text-zinc-600 text-xs">No downloads yet</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-hide">
                                {downloads.slice(0, 20).map(dl => (
                                    <div key={dl.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/3 border border-white/5">
                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                            {dl.status === 'downloading' && <Loader2 size={14} className="text-accent animate-spin" />}
                                            {dl.status === 'completed' && <CheckCircle size={14} className="text-green-400" />}
                                            {dl.status === 'cancelled' && <XCircle size={14} className="text-zinc-500" />}
                                            {dl.status === 'failed' && <AlertCircle size={14} className="text-red-400" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-xs font-medium truncate">{dl.title}</p>
                                            {dl.status === 'downloading' ? (
                                                <div className="mt-1">
                                                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                                                        <div className="h-full bg-accent transition-all" style={{ width: `${dl.progress}%` }} />
                                                    </div>
                                                    <p className="text-[9px] text-zinc-500 mt-0.5">{dl.progress}% • {dl.speed}</p>
                                                </div>
                                            ) : (
                                                <p className={`text-[10px] mt-0.5 uppercase tracking-wider font-bold ${dl.status === 'completed' ? 'text-green-500/60' :
                                                    dl.status === 'failed' ? 'text-red-400/60' : 'text-zinc-600'
                                                    }`}>{dl.status}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* ─── Sleep Timer ─── */}
                    <section className="glass-panel rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                                <Moon size={16} className="text-accent" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-white font-medium text-sm">Sleep Timer</h3>
                                <p className="text-zinc-600 text-[11px] mt-0.5">Auto-stop playback after timer ends</p>
                            </div>
                        </div>

                        {sleepMinutes > 0 ? (
                            <div className="text-center py-3">
                                <p className="text-3xl font-black text-accent font-mono tabular-nums">
                                    {formatSleepTime(sleepRemaining)}
                                </p>
                                <p className="text-zinc-500 text-[10px] uppercase tracking-widest mt-1">Remaining</p>
                                <button
                                    onClick={cancelSleepTimer}
                                    className="mt-3 px-5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider transition-colors border border-red-500/20"
                                >
                                    Cancel Timer
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="grid grid-cols-4 gap-2">
                                    {[15, 30, 45, 60].map(min => (
                                        <button
                                            key={min}
                                            onClick={() => startSleepTimer(min)}
                                            className="py-3 rounded-xl bg-white/3 hover:bg-accent/10 hover:text-accent text-zinc-400 text-sm font-bold transition-all border border-white/5 hover:border-accent/20"
                                        >
                                            {min}m
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="480"
                                        placeholder="Custom min"
                                        value={customMinutes}
                                        onChange={e => setCustomMinutes(e.target.value)}
                                        className="flex-1 px-3 py-2.5 rounded-xl bg-white/3 border border-white/5 text-zinc-300 text-sm placeholder:text-zinc-700 outline-none focus:border-accent/30"
                                    />
                                    <button
                                        onClick={() => { const m = parseInt(customMinutes); if (m > 0) { startSleepTimer(m); setCustomMinutes(''); } }}
                                        className="px-4 py-2.5 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent text-xs font-bold uppercase tracking-wider transition-colors border border-accent/20"
                                    >
                                        Set
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* ─── Library Backup ─── */}
                    <section className="glass-panel rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                                <Archive size={16} className="text-accent" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-white font-medium text-sm">Library Backup</h3>
                                <p className="text-zinc-600 text-[11px] mt-0.5">Export or import your library metadata</p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleExport}
                                className="flex-1 py-3 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent font-bold text-xs uppercase tracking-wider transition-all border border-accent/20"
                            >
                                Export Backup
                            </button>
                            <button
                                onClick={() => backupInputRef.current?.click()}
                                className="flex-1 py-3 rounded-xl bg-white/3 hover:bg-white/5 text-zinc-300 font-bold text-xs uppercase tracking-wider transition-all border border-white/5"
                            >
                                Import Backup
                            </button>
                            <input ref={backupInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
                        </div>

                        {backupStatus && (
                            <p className="text-xs text-center text-accent/80 animate-pulse">{backupStatus}</p>
                        )}
                    </section>

                    {/* ─── Earphone Controls ─── */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                                <Headphones size={16} className="text-accent" />
                            </div>
                            <div>
                                <h3 className="text-white font-medium text-sm">Earphone Controls</h3>
                                <p className="text-zinc-600 text-[11px] mt-0.5">Play/Pause, Next, Previous via headset buttons</p>
                            </div>
                        </div>
                        <div className="bg-white/3 rounded-xl p-3 space-y-1.5">
                            <p className="text-[10px] text-zinc-400 flex items-center justify-between">
                                <span>▶ Play / ⏸ Pause</span><span className="text-accent/60">Single press</span>
                            </p>
                            <p className="text-[10px] text-zinc-400 flex items-center justify-between">
                                <span>⏭ Next Track</span><span className="text-accent/60">Double press</span>
                            </p>
                            <p className="text-[10px] text-zinc-400 flex items-center justify-between">
                                <span>⏮ Previous Track</span><span className="text-accent/60">Triple press</span>
                            </p>
                            <p className="text-[9px] text-zinc-600 mt-2">Works with Bluetooth & wired headsets via MediaSession API</p>
                        </div>
                    </section>

                    {/* ─── Appearance ─── */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                                    <Type size={16} className="text-accent" />
                                </div>
                                <div>
                                    <h3 className="text-white font-medium text-sm">Light Text Mode</h3>
                                    <p className="text-zinc-600 text-[11px] mt-0.5">Switch text to black (for light themes)</p>
                                </div>
                            </div>
                            <button
                                onClick={toggleLightText}
                                className={`w-12 h-7 rounded-full transition-all relative ${lightText ? 'bg-accent' : 'bg-white/10'}`}
                            >
                                <div className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-1 transition-all ${lightText ? 'right-1' : 'left-1'}`} />
                            </button>
                        </div>
                    </section>

                    {/* ─── Audio Enhancement ─── */}
                    <section className="glass-panel rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                                <span className="text-lg">🎧</span>
                            </div>
                            <div>
                                <h3 className="text-white font-medium text-sm">Audio Enhancement</h3>
                                <p className="text-zinc-600 text-[11px] mt-0.5">Dolby-style spatial audio & EQ presets</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                            {getAvailablePresets().map(p => {
                                const isActive = activePreset === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => { setPreset(p.id); setActivePreset(p.id); }}
                                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all border
                                            ${isActive
                                                ? 'bg-accent/15 border-accent/30 text-accent'
                                                : 'bg-white/3 border-white/5 text-zinc-500 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        <span className="text-lg">{p.icon}</span>
                                        <span className="text-[9px] font-bold tracking-wide">{p.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[9px] text-zinc-600 text-center">
                            {getAvailablePresets().find(p => p.id === activePreset)?.description || 'Standard audio'}
                        </p>
                    </section>

                    {/* ─── About ─── */}
                    <section className="glass-panel rounded-2xl p-5 space-y-3">
                        <h3 className="text-xs font-bold tracking-[0.2em] text-zinc-500 uppercase">About</h3>
                        <div className="flex items-center justify-between py-1">
                            <span className="text-zinc-400 text-sm">Version</span>
                            <span className="text-zinc-600 text-sm font-mono">2.0.0</span>
                        </div>
                        <div className="h-px bg-white/5" />
                        <div className="flex items-center justify-between py-1">
                            <span className="text-zinc-400 text-sm">Theme</span>
                            <span className="text-accent text-sm font-medium">
                                {THEMES.find(t => t.id === theme)?.name || 'Default'}
                            </span>
                        </div>
                        <div className="h-px bg-white/5" />
                        <div className="flex items-center justify-between py-1">
                            <span className="text-zinc-400 text-sm">Engine</span>
                            <span className="text-zinc-600 text-sm font-mono">Web Audio API</span>
                        </div>
                    </section>

                    {/* ─── Danger Zone ─── */}
                    <section className="rounded-2xl p-5 space-y-4 border border-red-500/10 bg-red-500/2 mb-24">
                        <div className="flex items-center gap-2">
                            <Shield size={14} className="text-red-400/60" />
                            <h3 className="text-xs font-bold tracking-[0.2em] text-red-400/60 uppercase">Danger Zone</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-zinc-300 font-medium text-sm">Reset Preferences</p>
                                    <p className="text-zinc-600 text-[11px] mt-0.5">Clear UI settings. Music stays safe.</p>
                                </div>
                                <button
                                    onClick={handleResetSettings}
                                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs tracking-wider transition-colors border border-white/5 flex items-center gap-1.5 shrink-0"
                                >
                                    <RotateCcw size={12} /> Reset
                                </button>
                            </div>
                            <div className="h-px bg-red-500/10" />
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-red-200 font-medium text-sm">Delete All Data</p>
                                    <p className="text-red-400/40 text-[11px] mt-0.5">Permanently erase everything.</p>
                                </div>
                                <button
                                    onClick={handleDeleteAllData}
                                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs tracking-wider transition-colors shadow-[0_0_12px_rgba(220,38,38,0.3)] flex items-center gap-1.5 shrink-0"
                                >
                                    <Trash2 size={12} /> Delete
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </PageTransition>
    );
};

export default Settings;
