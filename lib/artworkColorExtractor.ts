/**
 * Fast & Lightweight Artwork Accent Color Extractor
 * Extracts dominant accent color from track artwork for subtle glow blending.
 */

export interface RgbColor {
    r: number;
    g: number;
    b: number;
}

const DEFAULT_EMERALD: RgbColor = { r: 16, g: 185, b: 129 };
const colorCache = new Map<string, RgbColor>();

export async function extractArtworkAccentColor(imageUrl?: string): Promise<RgbColor> {
    if (!imageUrl) return DEFAULT_EMERALD;

    if (colorCache.has(imageUrl)) {
        return colorCache.get(imageUrl)!;
    }

    return new Promise((resolve) => {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            const timeoutId = setTimeout(() => {
                resolve(DEFAULT_EMERALD);
            }, 1500);

            img.onload = () => {
                clearTimeout(timeoutId);
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 16;
                    canvas.height = 16;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    if (!ctx) {
                        resolve(DEFAULT_EMERALD);
                        return;
                    }

                    ctx.drawImage(img, 0, 0, 16, 16);
                    const imgData = ctx.getImageData(0, 0, 16, 16).data;

                    let totalR = 0;
                    let totalG = 0;
                    let totalB = 0;
                    let validCount = 0;

                    let bestVibrancy = -1;
                    let bestR = 16;
                    let bestG = 185;
                    let bestB = 129;

                    for (let i = 0; i < imgData.length; i += 4) {
                        const r = imgData[i];
                        const g = imgData[i + 1];
                        const b = imgData[i + 2];
                        const a = imgData[i + 3];

                        if (a < 128) continue;

                        const max = Math.max(r, g, b);
                        const min = Math.min(r, g, b);
                        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                        const saturation = max === 0 ? 0 : (max - min) / max;

                        // Filter out extreme blacks, extreme whites, and washed-out greys
                        if (brightness > 35 && brightness < 225 && saturation > 0.15) {
                            totalR += r;
                            totalG += g;
                            totalB += b;
                            validCount++;

                            const vibrancy = saturation * 0.7 + (brightness / 255) * 0.3;
                            if (vibrancy > bestVibrancy) {
                                bestVibrancy = vibrancy;
                                bestR = r;
                                bestG = g;
                                bestB = b;
                            }
                        }
                    }

                    let chosenColor: RgbColor = DEFAULT_EMERALD;

                    if (bestVibrancy > 0.2) {
                        // Harmonize chosen color towards a refined, elegant tone (avoid hyper-neon clash)
                        chosenColor = {
                            r: Math.round(bestR * 0.7 + 16 * 0.3),
                            g: Math.round(bestG * 0.7 + 185 * 0.3),
                            b: Math.round(bestB * 0.7 + 129 * 0.3)
                        };
                    } else if (validCount > 0) {
                        chosenColor = {
                            r: Math.round((totalR / validCount) * 0.5 + 16 * 0.5),
                            g: Math.round((totalG / validCount) * 0.5 + 185 * 0.5),
                            b: Math.round((totalB / validCount) * 0.5 + 129 * 0.5)
                        };
                    }

                    colorCache.set(imageUrl, chosenColor);
                    resolve(chosenColor);
                } catch {
                    resolve(DEFAULT_EMERALD);
                }
            };

            img.onerror = () => {
                clearTimeout(timeoutId);
                resolve(DEFAULT_EMERALD);
            };

            img.src = imageUrl;
        } catch {
            resolve(DEFAULT_EMERALD);
        }
    });
}
