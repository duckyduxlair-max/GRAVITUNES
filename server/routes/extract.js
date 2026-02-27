import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, unlinkSync, statSync, createReadStream } from 'fs';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.join(__dirname, '..', 'temp');
const COOKIES_PATH = path.join(__dirname, '..', 'cookies.txt');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

import { ffmpegDir, ytdlpPath } from '../utils/deps.js';

export const extractRouter = Router();

/**
 * Validate YouTube URL
 */
function isValidYouTubeUrl(url) {
    const patterns = [
        /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]{11}/,
        /^https?:\/\/youtu\.be\/[\w-]{11}/,
        /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]{11}/,
        /^https?:\/\/music\.youtube\.com\/watch\?v=[\w-]{11}/,
    ];
    return patterns.some(p => p.test(url));
}

/**
 * Get video info via yt-dlp
 */
function getVideoInfo(url) {
    return new Promise((resolve, reject) => {
        const args = [
            '--dump-json',
            '--no-warnings',
            '--no-playlist',
        ];
        if (ffmpegDir) {
            args.push('--ffmpeg-location', ffmpegDir);
        }
        args.push(url);
        const proc = spawn(ytdlpPath || 'yt-dlp', args);

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr || `yt-dlp exited with code ${code}`));
                return;
            }
            try {
                const info = JSON.parse(stdout);
                resolve({
                    title: info.title || 'Unknown Title',
                    duration: info.duration || 0,
                    id: info.id,
                });
            } catch (e) {
                reject(new Error('Failed to parse video info'));
            }
        });

        proc.on('error', (err) => {
            reject(new Error(`Failed to run yt-dlp: ${err.message}. Make sure yt-dlp is installed.`));
        });
    });
}

/**
 * Download and convert to MP3
 */
function downloadAudio(url, outputPath) {
    return new Promise((resolve, reject) => {
        const args = [
            '-f', 'bestaudio/best',
            '-x',
            '--audio-format', 'mp3',
            '--audio-quality', '0',
            '--no-playlist',
            '--no-warnings',
            '-o', outputPath,
        ];
        if (ffmpegDir) {
            args.push('--ffmpeg-location', ffmpegDir);
        }
        args.push(url);
        const proc = spawn(ytdlpPath || 'yt-dlp', args);

        let stderr = '';

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr || `Download failed with code ${code}`));
                return;
            }
            resolve();
        });

        proc.on('error', (err) => {
            reject(new Error(`Failed to run yt-dlp: ${err.message}. Make sure yt-dlp and ffmpeg are installed.`));
        });
    });
}

/**
 * POST /api/extract
 * Body: { url: "https://youtube.com/watch?v=..." }
 * Response: MP3 binary stream
 */
extractRouter.post('/', async (req, res) => {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid URL' });
    }

    if (!isValidYouTubeUrl(url)) {
        return res.status(400).json({ error: 'Invalid YouTube URL.' });
    }

    const jobId = uuidv4();
    const outputPath = path.join(TEMP_DIR, `${jobId}`);
    const expectedMp3 = `${outputPath}.mp3`;

    try {
        console.log(`[${jobId}] Fetching info for: ${url}`);
        const info = await getVideoInfo(url);
        console.log(`[${jobId}] Title: "${info.title}", Duration: ${info.duration}s`);

        if (info.duration > 1200) {
            return res.status(400).json({ error: 'Video is too long (max 20 minutes).' });
        }

        console.log(`[${jobId}] Downloading and converting to MP3...`);
        await downloadAudio(url, outputPath);

        if (!existsSync(expectedMp3)) {
            return res.status(500).json({ error: 'Conversion failed — output file not found.' });
        }

        const stat = statSync(expectedMp3);
        if (stat.size > MAX_FILE_SIZE) {
            unlinkSync(expectedMp3);
            return res.status(400).json({ error: `File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max is 50MB.` });
        }

        console.log(`[${jobId}] Success! File size: ${(stat.size / 1024 / 1024).toFixed(2)}MB`);

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('X-Title', encodeURIComponent(info.title));
        res.setHeader('X-Duration', String(info.duration));

        const stream = createReadStream(expectedMp3);
        stream.pipe(res);

        stream.on('end', () => {
            try { unlinkSync(expectedMp3); } catch { /* ignore */ }
            console.log(`[${jobId}] Temp file cleaned up.`);
        });

        stream.on('error', (err) => {
            console.error(`[${jobId}] Stream error:`, err);
            try { unlinkSync(expectedMp3); } catch { /* ignore */ }
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream audio file.' });
            }
        });

    } catch (err) {
        console.error(`[${jobId}] Error:`, err.message);
        try { if (existsSync(expectedMp3)) unlinkSync(expectedMp3); } catch { /* ignore */ }

        const msg = err.message.toLowerCase();
        if (msg.includes('private') || msg.includes('sign in')) {
            return res.status(403).json({ error: 'This video is private or requires sign-in.' });
        }
        if (msg.includes('copyright') || msg.includes('blocked')) {
            return res.status(403).json({ error: 'This video is blocked due to copyright.' });
        }
        if (msg.includes('not found') || msg.includes('unavailable')) {
            return res.status(404).json({ error: 'Video not found or unavailable.' });
        }

        return res.status(500).json({ error: err.message || 'Extraction failed.' });
    }
});
