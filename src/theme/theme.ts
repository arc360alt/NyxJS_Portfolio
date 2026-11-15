import { site } from '../content';
import { storage } from '../lib/storage';
import { prefersReducedMotion } from './motion';
import { pickSeedColors, samplePixels, type SeedColor } from './extract';
import { schemeToVars } from './scheme';

export type ThemeMode = 'system' | 'light' | 'dark';

const MODE_KEY = 'nyx:theme-mode';
/** Only set when a visitor picks a color; otherwise the site follows the pfp. */
const SEED_KEY = 'nyx:wallpaper';
/** Read by the inline script in index.html to paint the right colors before JS loads. */
const CACHE_KEY = 'nyx:theme-cache';

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

let mode: ThemeMode = (storage.get(MODE_KEY) as ThemeMode | null) ?? 'system';
if (!['system', 'light', 'dark'].includes(mode)) mode = 'system';
/** Pfp colors extracted in the browser (when the build couldn't), keyed by image URL. */
const PFP_CACHE_KEY = 'nyx:pfp-colors';
const pfpUrl = `${import.meta.env.BASE_URL}${site.assets.pfp.replace(/^\//, '')}`;

function readPfpCache(): SeedColor[] {
  try {
    const c = JSON.parse(storage.get(PFP_CACHE_KEY) ?? 'null');
    return c?.src === pfpUrl && Array.isArray(c.colors) ? c.colors : [];
  } catch {
    return [];
  }
}

let pfpColors: SeedColor[] = site.pfpColors.length ? site.pfpColors : site.themeSource === 'pfp' ? readPfpCache() : [];
/** The color used when the visitor hasn't picked one. */
let defaultSeed = pfpColors[0]?.seed ?? site.seed;

const offered = () => [...pfpColors, ...site.wallpapers].map((w) => w.seed.toLowerCase());
let seed = storage.get(SEED_KEY) ?? defaultSeed;
// Ignore saved picks that are no longer offered (e.g. after changing your pfp).
if (!offered().includes(seed.toLowerCase())) seed = defaultSeed;

export const getPfpColors = () => pfpColors;

export const getMode = () => mode;
export const getSeed = () => seed;
export const isDark = () => (mode === 'system' ? darkQuery.matches : mode === 'dark');

function apply() {
  const dark = isDark();
  const vars = schemeToVars(seed, dark);
  const root = document.documentElement;
  let css = '';
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
    css += `${k}:${v};`;
  }
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.colorScheme = dark ? 'dark' : 'light';
  storage.set(CACHE_KEY, JSON.stringify({ dark, css }));

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = vars['--md-sys-color-surface'];

  window.dispatchEvent(new CustomEvent('themechange', { detail: { dark, seed, mode } }));
}

/**
 * Runs a theme change, using a circular reveal from `origin` when the
 * View Transitions API is available and motion is allowed.
 */
function transition(update: () => void, origin?: { x: number; y: number }) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
  if (!doc.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }
  const vt = doc.startViewTransition(update);
  if (!origin) return;
  const r = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
  vt.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${r}px at ${origin.x}px ${origin.y}px)`] },
        { duration: 550, easing: 'cubic-bezier(0.2, 0, 0, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => {});
}

export function setMode(next: ThemeMode, origin?: { x: number; y: number }) {
  if (next === mode) return;
  const wasDark = isDark();
  mode = next;
  storage.set(MODE_KEY, next);
  if (isDark() === wasDark) {
    apply();
    return;
  }
  transition(apply, origin);
}

export function toggleDark(origin?: { x: number; y: number }) {
  const target: ThemeMode = isDark() ? 'light' : 'dark';
  // If the toggle lands on what the OS already prefers, go back to following the system.
  setMode(target === (darkQuery.matches ? 'dark' : 'light') ? 'system' : target, origin);
}

export function setSeed(next: string, origin?: { x: number; y: number }) {
  if (next.toLowerCase() === seed.toLowerCase()) return;
  seed = next;
  if (next.toLowerCase() === defaultSeed.toLowerCase()) storage.remove(SEED_KEY);
  else storage.set(SEED_KEY, next);
  transition(apply, origin);
}

export function initTheme() {
  apply();
  darkQuery.addEventListener('change', () => {
    if (mode === 'system') transition(apply);
  });
}

/**
 * Fallback for when the build couldn't read the pfp (see vite/pfp-colors.ts):
 * extract the colors here from the image itself, then theme with them and
 * cache the result so the next visit paints them immediately.
 */
export async function ensurePfpColors() {
  if (site.pfpColors.length || site.themeSource !== 'pfp') return;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = pfpUrl;
    await img.decode();
    const size = 128;
    const scale = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, w, h);
    const colors = pickSeedColors(samplePixels(ctx.getImageData(0, 0, w, h).data, w, h));
    if (!colors.length) return;
    storage.set(PFP_CACHE_KEY, JSON.stringify({ src: pfpUrl, colors }));
    const changed = JSON.stringify(colors) !== JSON.stringify(pfpColors);
    pfpColors = colors;
    const followingDefault = seed.toLowerCase() === defaultSeed.toLowerCase();
    defaultSeed = colors[0].seed;
    if (followingDefault && seed.toLowerCase() !== defaultSeed.toLowerCase()) {
      seed = defaultSeed;
      transition(apply);
    }
    if (changed) window.dispatchEvent(new CustomEvent('pfpcolors'));
  } catch {
    /* no pfp, or it couldn't be read — keep the configured seed */
  }
}
