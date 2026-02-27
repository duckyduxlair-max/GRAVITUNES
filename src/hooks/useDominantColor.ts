import { useState, useEffect } from 'react';

export function useDominantColor(imageUrl: string | undefined): string {
    const [color, setColor] = useState<string>('255, 255, 255'); // Default white

    useEffect(() => {
        if (!imageUrl) {
            setColor('255, 255, 255');
            return;
        }

        const img = new Image();
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) return;

            // Scale down drastically for performance
            canvas.width = 64;
            canvas.height = 64;

            ctx.drawImage(img, 0, 0, 64, 64);

            try {
                const imageData = ctx.getImageData(0, 0, 64, 64);
                const data = imageData.data;

                let r = 0, g = 0, b = 0;
                let count = 0;

                // Sample every 4th pixel to get a rough average
                for (let i = 0; i < data.length; i += 16) {
                    // Skip transparent/extremely dark pixels
                    if (data[i + 3] > 128 && (data[i] > 20 || data[i + 1] > 20 || data[i + 2] > 20)) {
                        r += data[i];
                        g += data[i + 1];
                        b += data[i + 2];
                        count++;
                    }
                }

                if (count > 0) {
                    r = Math.floor(r / count);
                    g = Math.floor(g / count);
                    b = Math.floor(b / count);

                    // Boost saturation/brightness slightly for a neon feel
                    const max = Math.max(r, g, b);
                    if (max < 200 && max > 0) {
                        const multiplier = 220 / max;
                        r = Math.min(255, Math.floor(r * multiplier));
                        g = Math.min(255, Math.floor(g * multiplier));
                        b = Math.min(255, Math.floor(b * multiplier));
                    }

                    setColor(`${r}, ${g}, ${b}`);
                }
            } catch (e) {
                console.error("Could not extract color. Cross-origin issue?", e);
                // Fallback to white on CORS error
                setColor('255, 255, 255');
            }
        };

        img.src = imageUrl;
    }, [imageUrl]);

    return color;
}
