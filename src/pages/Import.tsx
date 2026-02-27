import { useState } from 'react';
import { Download, Link as LinkIcon, Music, CheckCircle2, AlertCircle, Youtube, Loader2, HardDriveDownload } from 'lucide-react';
import { importAudioFromUrl, importFromYouTube, downloadSongToDevice } from '../services/audioService';
import PageTransition from '../components/layout/PageTransition';

type ImportMode = 'url' | 'youtube';

const Import = () => {
    const [mode, setMode] = useState<ImportMode>('youtube');
    const [url, setUrl] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [phase, setPhase] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [lastImported, setLastImported] = useState<{ id: string; title: string } | null>(null);

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim()) return;

        setStatus('loading');
        setProgress(0);
        setErrorMessage('');
        const currentUrl = url.trim();

        if (mode === 'youtube') {
            setPhase('Connecting to YouTube...');
            const result = await importFromYouTube(currentUrl, (p) => {
                setProgress(p);
                if (p < 10) setPhase('Extracting audio from YouTube...');
                else if (p < 50) setPhase('Downloading audio...');
                else if (p < 90) setPhase('Saving to library...');
                else setPhase('Almost done...');
            });

            if (result.success) {
                setStatus('success');
                setPhase('');
                const songId = `yt_${currentUrl}`;
                setLastImported({ id: songId, title: 'YouTube Audio' });
                setUrl('');
            } else {
                setStatus('error');
                setPhase('');
                setErrorMessage(result.error || 'Failed to import audio.');
            }
        } else {
            setPhase('Downloading audio file...');
            const result = await importAudioFromUrl(currentUrl, (p) => {
                setProgress(p);
                if (p < 50) setPhase('Downloading...');
                else setPhase('Saving to library...');
            });

            if (result.success) {
                setStatus('success');
                setPhase('');
                setLastImported({ id: currentUrl, title: 'Audio Track' });
                setUrl('');
            } else {
                setStatus('error');
                setPhase('');
                setErrorMessage(result.error || 'Failed to import audio.');
            }
        }
    };

    return (
        <PageTransition>
            <div className="w-full max-w-2xl mx-auto min-h-full flex flex-col justify-start px-2 py-10 pb-32">
                <div className="text-center mb-10 shrink-0">
                    <div className="inline-flex items-center justify-center p-4 rounded-full bg-white/3 border border-white/5 mb-6 relative group">
                        <div className="absolute inset-0 bg-accent/10 blur-xl rounded-full group-hover:bg-accent/20 transition-colors" />
                        {mode === 'youtube'
                            ? <Youtube size={32} className="text-red-400 relative z-10" />
                            : <Download size={32} className="text-accent relative z-10" />
                        }
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-white/5 font-['Outfit'] leading-none select-none">
                        IMPORT
                    </h2>
                    <h3 className="text-lg font-bold tracking-wide text-white -mt-5 md:-mt-6 ml-1 font-['Outfit'] mb-4">
                        Import <span className="text-accent">Music</span>
                    </h3>
                    <p className="text-zinc-500 max-w-md mx-auto text-sm leading-relaxed px-4">
                        {mode === 'youtube'
                            ? 'Paste a YouTube URL to extract and save audio to your library.'
                            : 'Paste a direct URL to an audio file (.mp3, .wav, .ogg).'
                        }
                    </p>
                </div>

                {/* Mode Tabs */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    <button
                        onClick={() => { setMode('youtube'); setStatus('idle'); setUrl(''); setPhase(''); }}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all flex items-center gap-2
                            ${mode === 'youtube'
                                ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                                : 'bg-white/3 text-zinc-500 hover:text-white border border-white/5'
                            }`}
                    >
                        <Youtube size={16} /> YouTube
                    </button>
                    <button
                        onClick={() => { setMode('url'); setStatus('idle'); setUrl(''); setPhase(''); }}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all flex items-center gap-2
                            ${mode === 'url'
                                ? 'bg-accent/15 text-accent border border-accent/20'
                                : 'bg-white/3 text-zinc-500 hover:text-white border border-white/5'
                            }`}
                    >
                        <LinkIcon size={16} /> Direct URL
                    </button>
                </div>

                {/* Input Form */}
                <form onSubmit={handleImport} className="glass-panel p-5 md:p-6 rounded-2xl">
                    <div className="relative mb-4">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
                            {mode === 'youtube' ? <Youtube size={18} /> : <LinkIcon size={18} />}
                        </div>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            disabled={status === 'loading'}
                            placeholder={mode === 'youtube'
                                ? 'https://www.youtube.com/watch?v=...'
                                : 'https://example.com/audio.mp3'
                            }
                            className="w-full bg-black/40 border border-white/5 text-white rounded-xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-accent/30 transition-all placeholder:text-zinc-600 disabled:opacity-50"
                        />
                    </div>

                    {/* Progress Bar */}
                    {status === 'loading' && (
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Loader2 size={14} className="animate-spin text-accent" />
                                    <span className="text-xs text-zinc-400">{phase}</span>
                                </div>
                                {progress > 0 && (
                                    <span className="text-xs text-zinc-500">{progress}%</span>
                                )}
                            </div>
                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${progress > 0
                                        ? 'bg-linear-to-r from-accent to-accent/40'
                                        : 'bg-accent/50 animate-pulse w-full'
                                        }`}
                                    style={progress > 0 ? { width: `${progress}%` } : { width: '100%' }}
                                />
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={status === 'loading' || !url.trim()}
                        className={`w-full py-3.5 rounded-xl font-bold tracking-wider text-sm flex items-center justify-center gap-2 transition-all
                            ${status === 'loading'
                                ? 'bg-white/5 text-zinc-500 cursor-not-allowed'
                                : 'bg-accent text-black hover:bg-accent/80 hover:shadow-[0_0_20px_rgba(var(--accent-rgb),0.3)]'
                            }`}
                    >
                        {status === 'loading' ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                PROCESSING...
                            </>
                        ) : (
                            <>
                                <Music size={16} />
                                {mode === 'youtube' ? 'EXTRACT AUDIO' : 'IMPORT TRACK'}
                            </>
                        )}
                    </button>

                    {/* Success */}
                    {status === 'success' && (
                        <div className="mt-4 space-y-3">
                            <div className="flex items-center gap-2 text-green-400 bg-green-400/10 p-3 rounded-xl border border-green-400/20 text-sm">
                                <CheckCircle2 size={16} />
                                Imported and saved to Library!
                            </div>
                            <div className="flex gap-2">
                                {lastImported && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await downloadSongToDevice(lastImported.id, lastImported.title);
                                        }}
                                        className="flex-1 py-2.5 rounded-xl bg-accent/10 text-accent border border-accent/20 text-sm font-bold tracking-wider flex items-center justify-center gap-2 hover:bg-accent/20 transition-all"
                                    >
                                        <HardDriveDownload size={16} /> DOWNLOAD MP3
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => { setStatus('idle'); setLastImported(null); }}
                                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-zinc-400 border border-white/5 text-sm font-bold tracking-wider flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                                >
                                    IMPORT ANOTHER
                                </button>
                            </div>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="mt-4 flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20 text-sm">
                            <AlertCircle size={16} />
                            {errorMessage}
                        </div>
                    )}
                </form>

                <p className="mt-5 text-center text-[10px] text-zinc-600 tracking-wider">
                    {mode === 'youtube'
                        ? 'SUPPORTS: YOUTUBE LINKS • UNLIMITED DURATION • SAVES TO LOCAL LIBRARY'
                        : 'SUPPORTS: .MP3, .WAV, .OGG, .FLAC • DIRECT LINKS ONLY'
                    }
                </p>
            </div>
        </PageTransition>
    );
};

export default Import;
