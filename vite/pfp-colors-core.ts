import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { Hct, QuantizerCelebi, Score, argbFromRgb, hexFromArgb } from '@material/material-color-utilities';
export { schemeToVars } from '../src/theme/scheme.ts';

/** Color math for vite/pfp-colors.ts, loaded through Vite's module runner (see there). */

const hueNames: [number, string][] = [
  [15, 'Rose'], [45, 'Coral'], [70, 'Amber'], [100, 'Gold'], [125, 'Olive'], [150, 'Lime'],
  [175, 'Green'], [200, 'Teal'], [225, 'Cyan'], [250, 'Sky'], [275, 'Blue'], [300, 'Indigo'],
  [325, 'Violet'], [345, 'Orchid'], [360, 'Rose'],
];
const nameFor = (hue: number) => hueNames.find(([max]) => hue < max)?.[1] ?? 'Rose';

/** Ranked, hue-distinct seed colors from a PNG. */
export function colorsFromPng(file: string, max = 4): { name: string; seed: string }[] {
  const png = PNG.sync.read(readFileSync(file));
  const pixels: number[] = [];
  // Sample ~40k pixels at most; quantizing more doesn't change the result.
  const step = Math.max(1, Math.floor(Math.sqrt((png.width * png.height) / 40000)));
  for (let y = 0; y < png.height; y += step) {
    for (let x = 0; x < png.width; x += step) {
      const i = (y * png.width + x) * 4;
      if (png.data[i + 3] < 255) continue;
      pixels.push(argbFromRgb(png.data[i], png.data[i + 1], png.data[i + 2]));
    }
  }
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

