import { Router } from 'express';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COOKIES_PATH = path.join(__dirname, '..', 'cookies.txt');

export const searchRouter = Router();

/**
 * GET /api/search?q=<query>
 * Search YouTube using yt-dlp --dump-json (one JSON per line)
 */
searchRouter.get('/', async (req, res) => {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
        return res.status(400).json({ error: 'Missing search query. Use ?q=<query>' });
    }

    try {
        const limit = 15;
        const searchQuery = `ytsearch${limit}:${q.trim()}`;

        const results = await new Promise((resolve, reject) => {
            const args = [
                '--flat-playlist',
                '--dump-json',
                '--no-warnings',
                '--default-search', 'ytsearch',
                '--skip-download',
            ];

            // Add cookies for authenticated requests
            if (existsSync(COOKIES_PATH)) {
                args.push('--cookies', COOKIES_PATH);
            }

            args.push(searchQuery);

            console.log(`[search] Searching: ${q.trim()}`);

            const proc = spawn('yt-dlp', args);
            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => { stdout += data.toString(); });
            proc.stderr.on('data', (data) => { stderr += data.toString(); });

            proc.on('error', (err) => {
                reject(new Error(`Failed to run yt-dlp: ${err.message}. Is it installed?`));
            });

            proc.on('close', (code) => {
                if (code !== 0 && !stdout) {
                    console.error('[search] stderr:', stderr);
                    reject(new Error(stderr || `yt-dlp search failed with code ${code}`));
                    return;
                }

                // Each line is a separate JSON object
                const lines = stdout.trim().split('\n').filter(Boolean);
                const tracks = [];

                for (const line of lines) {
                    try {
                        const item = JSON.parse(line);
                        tracks.push({
                            id: item.id,
                            title: item.title || 'Unknown Title',
                            artist: item.uploader || item.channel || 'Unknown Artist',
                            thumbnail: item.thumbnail || item.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
                            duration: formatDuration(item.duration),
                            durationSeconds: item.duration || 0,
                            url: item.url || item.webpage_url || `https://www.youtube.com/watch?v=${item.id}`,
                            views: item.view_count || 0,
                        });
                    } catch {
                        // Skip unparseable lines
                    }
                }

                console.log(`[search] Found ${tracks.length} results`);
                resolve(tracks);
            });
        });

        return res.json({ results });

    } catch (err) {
        console.error('Search error:', err.message);
        return res.status(500).json({ error: err.message || 'Search failed. Please try again.' });
    }
});

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
