import { runnerImport, type Plugin } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `virtual:pfp-colors` — Material You "wallpaper colors" pulled from your
 * profile picture at build time, the same way Android themes itself from a
 * wallpaper: quantize the image, score the colors, keep a few distinct hues.
 *
 * Also injects the scheme for the top color into index.html so the very first
 * paint already uses it (no flash of the default color).
 *
 * Only PNG is decoded. Any other format (or a missing file) falls back to
 * `theme.seed` in site.config.json.
 */

const VIRTUAL_ID = 'virtual:pfp-colors';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

interface Config {
  profile?: { pfp?: string };
  theme?: { source?: 'pfp' | 'seed'; seed?: string };
}

function readConfig(): Config {
  try {
    return JSON.parse(readFileSync(resolve('site.config.json'), 'utf8'));
  } catch {
    return {};
  }
}

export interface PfpColor {
  name: string;
  seed: string;
}

type Core = typeof import('./pfp-colors-core.ts');
let corePromise: Promise<Core> | null = null;
/**
 * @material/material-color-utilities uses extension-less ESM imports that plain
 * Node can't resolve, so the color code is loaded through Vite's module runner.
 */
const loadCore = () =>
  (corePromise ??= runnerImport<Core>(resolve('vite/pfp-colors-core.ts'), {
    configFile: false,
    logLevel: 'error',
    resolve: { noExternal: ['@material/material-color-utilities'] },
  }).then((r) => r.module));

async function compute(): Promise<PfpColor[]> {
  const config = readConfig();
  if ((config.theme?.source ?? 'pfp') !== 'pfp') return [];
  const file = resolve('public', (config.profile?.pfp ?? 'pfp.png').replace(/^\//, ''));
  if (!existsSync(file)) return [];
  if (!/\.png$/i.test(file)) {
    console.warn(`[pfp-colors] ${file} isn't a PNG; using theme.seed instead.`);
    return [];
  }
  try {
    return (await loadCore()).colorsFromPng(file);
  } catch (err) {
    console.warn(`[pfp-colors] couldn't read ${file}: ${(err as Error).message}`);
    return [];
  }
}

const toCss = (vars: Record<string, string>) => Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');

export function pfpColors(): Plugin {
  let colors: Promise<PfpColor[]> | null = null;
  const get = () => (colors ??= compute());
  const pfpPath = () => resolve('public', (readConfig().profile?.pfp ?? 'pfp.png').replace(/^\//, ''));

  return {
    name: 'nyx-pfp-colors',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return;
      this.addWatchFile(resolve('site.config.json'));
      return `export default ${JSON.stringify(await get())};`;
    },
    async transformIndexHtml(html) {
      const top = (await get())[0];
      if (!top) return html;
      const { schemeToVars } = await loadCore();
      // Unlayered, so it beats the default-seed fallback in fallback-colors.css.
      const style = `<style id="pfp-scheme">:root{${toCss(schemeToVars(top.seed, false))}}:root[data-theme="dark"]{${toCss(schemeToVars(top.seed, true))}}</style>`;
      return html.replace('</head>', `    ${style}\n  </head>`);
    },
    configureServer(server) {
      // Swapping the pfp (or the config) recomputes the colors.
      server.watcher.add(pfpPath());
      server.watcher.on('change', (file) => {
        if (file !== pfpPath() && file !== resolve('site.config.json')) return;
        colors = null;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}
