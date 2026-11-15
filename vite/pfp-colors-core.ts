import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { pickSeedColors, samplePixels } from '../src/theme/extract.ts';
export { schemeToVars } from '../src/theme/scheme.ts';

/** Color math for vite/pfp-colors.ts, loaded through Vite's module runner (see there). */

/** Ranked, hue-distinct seed colors from a PNG. */
export function colorsFromPng(file: string, max = 4) {
  const png = PNG.sync.read(readFileSync(file));
  return pickSeedColors(samplePixels(png.data, png.width, png.height), max);
}
