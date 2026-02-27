import { existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

export function findFfmpeg() {
    const isWin = process.platform === 'win32';

    if (isWin) {
        const candidates = [
            'C:\\ffmpeg\\bin\\ffmpeg.exe',
            'C:\\ffmpeg\\ffmpeg\\bin\\ffmpeg.exe',
            'C:\\ffmpeg\\ffmpeg.exe',
            'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
        ];

        for (const p of candidates) {
            if (existsSync(p)) return path.dirname(p);
        }

        try {
            const result = execSync('where ffmpeg', { stdio: 'pipe', encoding: 'utf8' }).trim();
            if (result) return path.dirname(result.split('\n')[0].trim());
        } catch { /* not on PATH */ }
    } else {
        const termuxPath = '/data/data/com.termux/files/usr/bin/ffmpeg';
        if (existsSync(termuxPath)) return path.dirname(termuxPath);

        try {
            const result = execSync('which ffmpeg', { stdio: 'pipe', encoding: 'utf8' }).trim();
            if (result) return path.dirname(result);
        } catch { /* not on PATH */ }
    }
    return null;
}

export function findYtdlp() {
    const isWin = process.platform === 'win32';

    if (isWin) {
        try {
            const result = execSync('where yt-dlp', { stdio: 'pipe', encoding: 'utf8' }).trim();
            if (result) return result.split('\n')[0].trim();
        } catch { /* not on PATH */ }

        const pythonScripts = path.join(
            process.env.LOCALAPPDATA || '',
            'Packages', 'PythonSoftwareFoundation.Python.3.10_qbz5n2kfra8p0',
            'LocalCache', 'local-packages', 'Python310', 'Scripts', 'yt-dlp.exe'
        );
        if (existsSync(pythonScripts)) return pythonScripts;
    } else {
        const termuxPath = '/data/data/com.termux/files/usr/bin/yt-dlp';
        if (existsSync(termuxPath)) return termuxPath;

        try {
            const result = execSync('which yt-dlp', { stdio: 'pipe', encoding: 'utf8' }).trim();
            if (result) return result;
        } catch { /* not on PATH */ }
    }
    return null;
}

export const ffmpegDir = findFfmpeg();
export const ytdlpPath = findYtdlp();
