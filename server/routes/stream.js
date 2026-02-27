import { Router } from 'express';
import { spawn } from 'child_process';
import { existsSync, unlinkSync, statSync, createReadStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COOKIES_PATH = path.join(__dirname, '..', 'cookies.txt');
const TEMP_DIR = path.join(__dirname, '..', 'temp');

import { ffmpegDir, ytdlpPath } from '../utils/deps.js';

export const streamRouter = Router();

/**
 * GET /api/stream?v=<videoId>
 * Downloads audio to temp file, serves it with proper headers, then cleans up.
 * This ensures HTMLAudioElement can play it (needs Content-Length).
 */
streamRouter.get('/', async (req, res) => {
    const { v } = req.query;

    if (!v || typeof v !== 'string') {
        return res.status(400).json({ error: 'Missing video ID (?v=VIDEO_ID)' });
    }

    const videoId = v.replace(/[^a-zA-Z0-9_-]/g, '');
    if (videoId.length < 8 || videoId.length > 15) {
        return res.status(400).json({ error: 'Invalid video ID' });
    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const jobId = uuidv4();
    const outputBase = path.join(TEMP_DIR, `stream_${jobId}`);
    const expectedFile = `${outputBase}.mp3`;

    const args = [
        '-f', 'ba[ext=m4a]/ba[ext=mp3]/ba',  // Prefer progressive m4a > mp3 > any best audio (avoids DASH)
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '5',       // Medium quality (faster than 0)
        '--no-playlist',
        '--no-warnings',
        '-o', outputBase,
    ];

    if (ffmpegDir) {
        args.push('--ffmpeg-location', ffmpegDir);
    }

    args.push(url);

    try {
        // Download and convert
        await new Promise((resolve, reject) => {
            const proc = spawn(ytdlpPath || 'yt-dlp', args);
            let stderr = '';

            proc.stderr.on('data', (data) => { stderr += data.toString(); });
            proc.on('error', (err) => reject(new Error(`yt-dlp error: ${err.message}`)));
            proc.on('close', (code) => {
                if (code !== 0) reject(new Error(stderr || `yt-dlp exited with code ${code}`));
                else resolve(undefined);
            });

            // Kill if client disconnects
            req.on('close', () => {
                proc.kill('SIGTERM');
                reject(new Error('Client disconnected'));
            });
        });

        if (!existsSync(expectedFile)) {
            return res.status(500).json({ error: 'Audio conversion failed' });
        }

        const stat = statSync(expectedFile);
        const fileSize = stat.size;

        // ── HTTP 206 Range support for partial content ──
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = end - start + 1;

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'no-store',
            });
            const stream = createReadStream(expectedFile, { start, end });
            stream.pipe(res);
            stream.on('end', () => {
                try { unlinkSync(expectedFile); } catch { /* ignore */ }
            });
        } else {
            // Full file serve
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Content-Length', fileSize);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Cache-Control', 'no-store');

            const stream = createReadStream(expectedFile);
            stream.pipe(res);

            // Cleanup after streaming
            stream.on('end', () => {
                try { unlinkSync(expectedFile); } catch { /* ignore */ }
            });

            stream.on('error', () => {
                try { unlinkSync(expectedFile); } catch { /* ignore */ }
            });
        }

        // Also cleanup if client disconnects mid-stream
        res.on('close', () => {
            setTimeout(() => {
                try { if (existsSync(expectedFile)) unlinkSync(expectedFile); } catch { /* ignore */ }
            }, 1000);
        });

    } catch (err) {
        // Cleanup on error
        try { if (existsSync(expectedFile)) unlinkSync(expectedFile); } catch { /* ignore */ }

        if (err.message === 'Client disconnected') return;

        console.error(`[stream ${jobId}] Error:`, err.message);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message || 'Stream failed' });
        }
    }
});
