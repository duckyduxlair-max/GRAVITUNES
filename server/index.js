import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { extractRouter } from './routes/extract.js';
import { searchRouter } from './routes/search.js';
import { streamRouter } from './routes/stream.js';
import { existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Ensure temp directory exists
const TEMP_DIR = path.join(__dirname, 'temp');
if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
}

import { ffmpegDir, ytdlpPath } from './utils/deps.js';

// Export for use in routes
export { ffmpegDir, ytdlpPath };

if (!ytdlpPath) {
    console.warn('⚠️  yt-dlp NOT FOUND. Install: pip install yt-dlp');
    console.warn('   Extract and stream endpoints will not work.\n');
} else {
    console.log(`✅ yt-dlp found: ${ytdlpPath}`);
}

if (!ffmpegDir) {
    console.warn('⚠️  ffmpeg NOT FOUND. Install from https://ffmpeg.org/download.html');
    console.warn('   Audio conversion may fail.\n');
} else {
    console.log(`✅ ffmpeg found: ${ffmpegDir}`);
}

// Check for cookies
const COOKIES_PATH = path.join(__dirname, 'cookies.txt');
if (existsSync(COOKIES_PATH)) {
    console.log('🍪 Cookies file found — authenticated requests enabled.');
} else {
    console.log('ℹ️  No cookies.txt found — anonymous requests only.');
}

// Middleware
app.use(cors({
    origin: true, // Allow all origins (LAN access from Termux/phone)
    exposedHeaders: ['X-Title', 'X-Duration', 'Content-Length']
}));
app.use(express.json({ limit: '1mb' }));

// Serve built frontend in production
const distPath = path.join(__dirname, '..', 'dist');
if (existsSync(distPath)) {
    app.use(express.static(distPath));
    console.log('📦 Serving production frontend from /dist');
}

// Rate Limiting
const extractLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: 'Too many requests. Please wait a minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Too many search requests.' },
});

// Routes
app.use('/api/extract', extractLimiter, extractRouter);
app.use('/api/search', searchLimiter, searchRouter);
app.use('/api/stream', streamRouter);

// Proxy for fetching images without CORS so frontend can convert to base64
app.get('/api/proxy-image', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'URL required' });

        const response = await fetch(url);
        if (!response.ok) throw new Error('Fetch failed');

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: 'Failed to proxy image' });
    }
});

// Health check
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        yt_dlp: !!ytdlpPath,
        ffmpeg: !!ffmpegDir,
        cookies: existsSync(COOKIES_PATH),
    });
});

// Shutdown endpoint for sleep timer
app.post('/api/shutdown', (_req, res) => {
    res.json({ status: 'shutting_down', message: 'GraviTunes server will exit in 2 seconds.' });
    console.log('\n🌙 Sleep timer triggered — shutting down in 2 seconds...');
    setTimeout(() => process.exit(0), 2000);
});

app.listen(PORT, '0.0.0.0', () => {
    const line = '═'.repeat(56);
    console.log(`\n  ╔${line}╗`);
    console.log(`  ║   🎵  G R A V I T U N E S   S E R V E R  v2.1.0     ║`);
    console.log(`  ╠${line}╣`);
    console.log(`  ║  Status:    ✅ Running on http://0.0.0.0:${PORT}           ║`);
    console.log(`  ║  yt-dlp:    ${ytdlpPath ? '✅ Found' : '❌ Missing'}${' '.repeat(ytdlpPath ? 41 : 40)}║`);
    console.log(`  ║  ffmpeg:    ${ffmpegDir ? '✅ Found' : '❌ Missing'}${' '.repeat(ffmpegDir ? 41 : 40)}║`);
    console.log(`  ║  Cookies:   ${existsSync(COOKIES_PATH) ? '🍪 Active' : 'ℹ️  None'}${' '.repeat(existsSync(COOKIES_PATH) ? 39 : 41)}║`);
    console.log(`  ╠${line}╣`);
    console.log(`  ║  Endpoints:                                          ║`);
    console.log(`  ║    POST /api/extract    → Extract audio from YT      ║`);
    console.log(`  ║    GET  /api/search     → Search YouTube             ║`);
    console.log(`  ║    GET  /api/stream     → Stream audio               ║`);
    console.log(`  ║    GET  /api/health     → Health check               ║`);
    console.log(`  ║    POST /api/shutdown   → Sleep timer shutdown        ║`);
    console.log(`  ║    GET  /api/proxy-image → Image proxy (CORS)        ║`);
    if (existsSync(distPath)) {
        console.log(`  ╠${line}╣`);
        console.log(`  ║  🌐 Open app: http://localhost:${PORT}                    ║`);
    }
    console.log(`  ╚${line}╝\n`);
});
