import { Hct, QuantizerCelebi, Score, hexFromArgb } from '@material/material-color-utilities';

/**
 * Picks Material You seed colors from an image's pixels, the way Android does
 * for wallpapers: quantize, score, then keep a few distinct, non-muddy hues.
 * Shared by the build step (vite/pfp-colors.ts) and the in-browser fallback.
 */

export interface SeedColor {
  name: string;
  seed: string;
}

const hueNames: [number, string][] = [
  [15, 'Rose'], [45, 'Coral'], [70, 'Amber'], [100, 'Gold'], [125, 'Olive'], [150, 'Lime'],
  [175, 'Green'], [200, 'Teal'], [225, 'Cyan'], [250, 'Sky'], [275, 'Blue'], [300, 'Indigo'],
  [325, 'Violet'], [345, 'Orchid'], [360, 'Rose'],
];
const nameFor = (hue: number) => hueNames.find(([max]) => hue < max)?.[1] ?? 'Rose';

/** `pixels` are opaque ARGB ints (sampling ~40k is plenty). */
export function pickSeedColors(pixels: number[], max = 4): SeedColor[] {
  if (!pixels.length) return [];
  const ranked = Score.score(QuantizerCelebi.quantize(pixels, 128), { desired: 12, filter: true, fallbackColorARGB: 0 });
  const picked: Hct[] = [];
  for (const argb of ranked) {
    if (!argb) continue;
    const hct = Hct.fromInt(argb);
    // Very washed-out colors make muddy themes; skip them unless it's all we have.
    if (picked.length && hct.chroma < 16) continue;
    if (picked.some((p) => Math.abs(((p.hue - hct.hue + 540) % 360) - 180) < 30)) continue;
    picked.push(hct);
    if (picked.length === max) break;
  }
  return picked.map((h) => ({ name: nameFor(h.hue), seed: hexFromArgb(h.toInt()) }));
}

/** Samples RGBA bytes (canvas ImageData or a decoded PNG) into opaque ARGB ints. */
export function samplePixels(data: ArrayLike<number>, width: number, height: number): number[] {
  const pixels: number[] = [];
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 40000)));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 255) continue;
      pixels.push(((0xff << 24) | (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]) >>> 0);
    }
  }
  return pixels;
}
