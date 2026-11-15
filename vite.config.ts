import { defineConfig, type Plugin } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { githubPinned } from './vite/github-pinned.ts';
import { pfpColors } from './vite/pfp-colors.ts';
import { copyFileSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Static hosts (GitHub Pages, Netlify, etc.) serve 404.html for unknown paths. */
function spa404(): Plugin {
  let outDir = 'dist';
  return {
    name: 'nyx-spa-404',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    },
  };
}

/**
 * Loads Material Symbols Rounded subset to only the icons the site uses, found
 * by scanning src/ and site.config.json for icon names.
 * Add an icon in site.config.json and it's picked up automatically.
 */
function materialSymbolsSubset(): Plugin {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|json)$/.test(p) ? [p] : [];
    });
  const collect = () => {
    const names = new Set<string>();
    const re = /(?:icon\(\s*|icon:\s*|iconOn:\s*|icon \?\?\s*|"icon":\s*)['"]([a-z0-9_]+)['"]/g;
    for (const file of [...walk(resolve('src')), resolve('site.config.json')]) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(re)) names.add(m[1]);
      // Icons picked at runtime can be listed in a comment: `// @icons name_one name_two`
      for (const m of text.matchAll(/@icons\s+([a-z0-9_ ]+)/g)) m[1].trim().split(/\s+/).forEach((n) => names.add(n));
    }
    return [...names].sort();
  };
  return {
    name: 'nyx-material-symbols',
    transformIndexHtml(html) {
      const href = `https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400..500,0..1,0&icon_names=${collect().join(',')}&display=block`;
      return html.replace('%MATERIAL_SYMBOLS_HREF%', href);
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), githubPinned(), pfpColors(), materialSymbolsSubset(), spa404()],
});
