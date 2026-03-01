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

// ─── Debug Logger ───
function log(jobId, ...args) {
    const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });
    console.log(`[${ts}][${jobId}]`, ...args);
}

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
function getVideoInfo(url, jobId) {
    return new Promise((resolve, reject) => {
        const args = [
            '--dump-json',
            '--no-warnings',
            '--no-playlist',
        ];
        const hasCookies = existsSync(COOKIES_PATH);
        if (hasCookies) {
            args.push('--cookies', COOKIES_PATH);
        }
        if (ffmpegDir) {
            args.push('--ffmpeg-location', ffmpegDir);
        }
        args.push(url);

        const bin = ytdlpPath || 'yt-dlp';
        log(jobId, `🔍 getVideoInfo START`);
        log(jobId, `   yt-dlp binary: ${bin}`);
        log(jobId, `   cookies: ${hasCookies ? '✅ YES' : '❌ NO'}`);
        log(jobId, `   args: ${args.join(' ')}`);

        const startTime = Date.now();
        const proc = spawn(bin, args);

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            log(jobId, `   [yt-dlp stderr] ${chunk.trim()}`);
        });

        proc.on('close', (code) => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            log(jobId, `🔍 getVideoInfo DONE in ${elapsed}s (exit code: ${code})`);

            if (code !== 0) {
                log(jobId, `   ❌ FAILED: ${stderr}`);
                reject(new Error(stderr || `yt-dlp exited with code ${code}`));
                return;
            }
            try {
                const info = JSON.parse(stdout);
                log(jobId, `   ✅ Title: "${info.title}", Duration: ${info.duration}s`);
                resolve({
                    title: info.title || 'Unknown Title',
                    duration: info.duration || 0,
                    id: info.id,
                });
            } catch (e) {
                log(jobId, `   ❌ JSON parse error: ${e.message}`);
                reject(new Error('Failed to parse video info'));
            }
        });

        proc.on('error', (err) => {
            log(jobId, `   ❌ spawn error: ${err.message}`);
            reject(new Error(`Failed to run yt-dlp: ${err.message}. Make sure yt-dlp is installed.`));
        });

        // Timeout after 60 seconds
        setTimeout(() => {
            try { proc.kill(); } catch { }
            log(jobId, `   ⏰ TIMEOUT: getVideoInfo killed after 60s`);
            reject(new Error('yt-dlp timed out after 60 seconds'));
        }, 60000);
    });
}

/**
 * Download and convert to MP3
 */
function downloadAudio(url, outputPath, jobId) {
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
        const hasCookies = existsSync(COOKIES_PATH);
        if (hasCookies) {
            args.push('--cookies', COOKIES_PATH);
        }
        if (ffmpegDir) {
            args.push('--ffmpeg-location', ffmpegDir);
        }
        args.push(url);

        const bin = ytdlpPath || 'yt-dlp';
        log(jobId, `📥 downloadAudio START`);
        log(jobId, `   output: ${outputPath}.mp3`);
        log(jobId, `   cookies: ${hasCookies ? '✅ YES' : '❌ NO'}`);

        const startTime = Date.now();
        const proc = spawn(bin, args);

        let stderr = '';
        let lastLog = Date.now();

        proc.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            // Log progress lines but throttle to every 2 seconds
            const now = Date.now();
            if (now - lastLog > 2000 || chunk.includes('ERROR') || chunk.includes('error')) {
                lastLog = now;
                log(jobId, `   [dl] ${chunk.trim().split('\n').pop()}`);
            }
        });

        proc.on('close', (code) => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            if (code !== 0) {
                log(jobId, `📥 downloadAudio FAILED in ${elapsed}s (exit code: ${code})`);
                log(jobId, `   ❌ stderr: ${stderr.slice(-500)}`);
                reject(new Error(stderr || `Download failed with code ${code}`));
                return;
            }
            log(jobId, `📥 downloadAudio DONE in ${elapsed}s ✅`);
            resolve();
        });

        proc.on('error', (err) => {
            log(jobId, `   ❌ spawn error: ${err.message}`);
            reject(new Error(`Failed to run yt-dlp: ${err.message}. Make sure yt-dlp and ffmpeg are installed.`));
        });

        // Timeout after 5 minutes
        setTimeout(() => {
            try { proc.kill(); } catch { }
            log(jobId, `   ⏰ TIMEOUT: downloadAudio killed after 5 minutes`);
            reject(new Error('Download timed out after 5 minutes'));
        }, 300000);
    });
}

/**
 * POST /api/extract
 * Body: { url: "https://youtube.com/watch?v=..." }
 * Response: MP3 binary stream
 */
extractRouter.post('/', async (req, res) => {
    const { url } = req.body;
    const jobId = uuidv4().slice(0, 8);

    log(jobId, `═══════════════════════════════════════`);
    log(jobId, `📨 NEW EXTRACT REQUEST`);
    log(jobId, `   URL: ${url}`);

    if (!url || typeof url !== 'string') {
        log(jobId, `   ❌ REJECTED: Missing or invalid URL`);
        return res.status(400).json({ error: 'Missing or invalid URL' });
    }

    if (!isValidYouTubeUrl(url)) {
        log(jobId, `   ❌ REJECTED: Not a valid YouTube URL`);
        return res.status(400).json({ error: 'Invalid YouTube URL.' });
    }

    log(jobId, `   ✅ URL valid`);

    const outputPath = path.join(TEMP_DIR, `${jobId}`);
    const expectedMp3 = `${outputPath}.mp3`;

    try {
        // Step 1: Get video info
        const info = await getVideoInfo(url, jobId);

        if (info.duration > 1200) {
            log(jobId, `   ❌ REJECTED: Too long (${info.duration}s > 1200s)`);
            return res.status(400).json({ error: 'Video is too long (max 20 minutes).' });
        }

        // Step 2: Download audio
        await downloadAudio(url, outputPath, jobId);

        if (!existsSync(expectedMp3)) {
            log(jobId, `   ❌ Output file not found at: ${expectedMp3}`);
            return res.status(500).json({ error: 'Conversion failed — output file not found.' });
        }

        const stat = statSync(expectedMp3);
        log(jobId, `📦 File ready: ${(stat.size / 1024 / 1024).toFixed(2)}MB`);

        if (stat.size > MAX_FILE_SIZE) {
            unlinkSync(expectedMp3);
            log(jobId, `   ❌ File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);
            return res.status(400).json({ error: `File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max is 50MB.` });
        }

        // Step 3: Stream back to client
        log(jobId, `📤 Streaming MP3 to client...`);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('X-Title', encodeURIComponent(info.title));
        res.setHeader('X-Duration', String(info.duration));

        const stream = createReadStream(expectedMp3);
        stream.pipe(res);

        stream.on('end', () => {
            try { unlinkSync(expectedMp3); } catch { /* ignore */ }
            log(jobId, `✅ COMPLETE — streamed & cleaned up`);
            log(jobId, `═══════════════════════════════════════`);
        });

        stream.on('error', (err) => {
            log(jobId, `   ❌ Stream error: ${err.message}`);
            try { unlinkSync(expectedMp3); } catch { /* ignore */ }
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream audio file.' });
            }
        });

    } catch (err) {
        log(jobId, `💥 EXTRACT FAILED: ${err.message}`);
        log(jobId, `═══════════════════════════════════════`);
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
        if (msg.includes('timed out')) {
            return res.status(504).json({ error: 'Download timed out. Try again.' });
        }

        return res.status(500).json({ error: err.message || 'Extraction failed.' });
    }
});
