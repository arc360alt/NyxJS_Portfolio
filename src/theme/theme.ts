import { site } from '../content';
import { storage } from '../lib/storage';
import { prefersReducedMotion } from './motion';
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
const offered = [...site.pfpColors, ...site.wallpapers].map((w) => w.seed.toLowerCase());
let seed = storage.get(SEED_KEY) ?? site.seed;
// Ignore saved picks that are no longer offered (e.g. after changing your pfp).
if (!offered.includes(seed.toLowerCase())) seed = site.seed;

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
  if (next.toLowerCase() === site.seed.toLowerCase()) storage.remove(SEED_KEY);
  else storage.set(SEED_KEY, next);
  transition(apply, origin);
}

export function initTheme() {
  apply();
  darkQuery.addEventListener('change', () => {
    if (mode === 'system') transition(apply);
  });
}
