import type { Plugin } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `virtual:github-pinned`
 *   default export   — the repos pinned on your GitHub profile
 *   `featuredRepos`  — details for repos named in site.config.json `featured`
 *                      that aren't already in your `projects` list
 *
 * GitHub's REST API doesn't expose pins (GraphQL needs a token), and browsers
 * can't read github.com directly, so this runs at dev/build time: it reads the
 * profile page, then fetches each pinned repo's details from the REST API.
 * Results are cached for an hour in node_modules/.cache to stay under the
 * unauthenticated rate limit. On any failure it exports [] and the site falls
 * back to `featured` flags in site.config.json.
 *
 * Set GITHUB_TOKEN in the environment to raise the API rate limit (optional).
 */

export interface PinnedRepo {
  owner: string;
  name: string;
  url: string;
  description: string | null;
  homepage: string | null;
  language: string | null;
  languages: string[];
  topics: string[];
}

const VIRTUAL_ID = 'virtual:github-pinned';
const RESOLVED_ID = '\0' + VIRTUAL_ID;
const CACHE_MS = 60 * 60 * 1000;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const headers = (): Record<string, string> => {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'nyx-portfolio' };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
};

async function fetchRepo(owner: string, name: string): Promise<PinnedRepo | null> {
  const base = `https://api.github.com/repos/${owner}/${name}`;
  const [repo, langs] = await Promise.all([
    fetch(base, { headers: headers() }).then((r) => (r.ok ? r.json() : null)),
    fetch(`${base}/languages`, { headers: headers() }).then((r) => (r.ok ? r.json() : {})),
  ]);
  if (!repo) return null;
  const entries = Object.entries(langs as Record<string, number>);
  const total = entries.reduce((n, [, v]) => n + v, 0) || 1;
  return {
    // Use GitHub's casing, e.g. "progression-mod" → "arc360alt/progression-mod".
    owner: repo.owner?.login ?? owner,
    name: repo.name ?? name,
    url: repo.html_url ?? `https://github.com/${owner}/${name}`,
    description: repo.description ?? null,
    homepage: repo.homepage || null,
    language: repo.language ?? null,
    // Languages making up at least 5% of the code, biggest first.
    languages: entries.filter(([, v]) => v / total >= 0.05).sort((a, b) => b[1] - a[1]).map(([k]) => k),
    topics: repo.topics ?? [],
  };
}

async function fetchPinned(username: string): Promise<PinnedRepo[]> {
  const html = await fetch(`https://github.com/${encodeURIComponent(username)}`, { headers: { 'User-Agent': UA } }).then((r) => {
    if (!r.ok) throw new Error(`profile ${r.status}`);
    return r.text();
  });
  const seen = new Set<string>();
  const pairs: [string, string][] = [];
  for (const m of html.matchAll(/PINNED_REPO[^>]*?href="\/([^"/]+)\/([^"/]+)"/g)) {
    const key = `${m[1]}/${m[2]}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([m[1], m[2]]);
  }
  const repos = await Promise.all(pairs.map(([owner, name]) => fetchRepo(owner, name)));
  return repos.filter((r): r is PinnedRepo => r !== null);
}

interface Cache {
  username: string;
  pinnedAt: number;
  pinned: PinnedRepo[];
  /** "owner/name" (lowercase) → repo, or null if it doesn't exist. */
  repos: Record<string, { at: number; repo: PinnedRepo | null }>;
}

/** "pronouns" → ["arc360alt", "pronouns"]; "Owner/Repo" → ["Owner", "Repo"]. */
function splitRepo(entry: string, username: string): [string, string] {
  const clean = entry.replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '');
  const [a, b] = clean.split('/');
  return b ? [a, b] : [username, a];
}

export function githubPinned(): Plugin {
  const cacheFile = resolve('node_modules/.cache/nyx-github-pinned.json');

  async function load(): Promise<{ pinned: PinnedRepo[]; featured: PinnedRepo[] }> {
    let config: {
      github?: { username?: string; featurePinned?: boolean };
      featured?: string[];
      projects?: { id: string; repo?: string }[];
    };
    try {
      config = JSON.parse(readFileSync(resolve('site.config.json'), 'utf8'));
    } catch {
      return { pinned: [], featured: [] };
    }
    const username = config.github?.username ?? '';
    if (!username) return { pinned: [], featured: [] };

    let cache: Cache = { username, pinnedAt: 0, pinned: [], repos: {} };
    try {
      const c = JSON.parse(readFileSync(cacheFile, 'utf8')) as Cache;
      if (c.username === username && c.repos && !Array.isArray(c.repos)) cache = c;
    } catch {
      /* no cache yet */
    }
    const now = Date.now();
    let dirty = false;

    // Pinned repos (only needed when there's no `featured` list).
    const featuredList = Array.isArray(config.featured) ? config.featured.filter((x) => typeof x === 'string' && x.trim()) : [];
    let pinned: PinnedRepo[] = [];
    if (!featuredList.length && config.github?.featurePinned !== false) {
      if (now - cache.pinnedAt < CACHE_MS) pinned = cache.pinned;
      else {
        try {
          pinned = await fetchPinned(username);
          cache.pinned = pinned;
          cache.pinnedAt = now;
          dirty = true;
        } catch (err) {
          console.warn(`[github-pinned] couldn't load pinned repos for ${username}: ${(err as Error).message}`);
          pinned = cache.pinned;
        }
      }
    }

    // Featured entries that aren't hand-written projects get looked up on GitHub.
    const listed = config.projects ?? [];
    const featured: PinnedRepo[] = [];
    for (const entry of featuredList) {
      const isListed = listed.some(
        (p) => p.id.toLowerCase() === entry.toLowerCase() || (p.repo ?? '').toLowerCase().replace(/\/+$/, '').endsWith(`/${entry.toLowerCase()}`),
      );
      if (isListed) continue;
      const [owner, name] = splitRepo(entry, username);
      const key = `${owner}/${name}`.toLowerCase();
      const hit = cache.repos[key];
      if (hit && now - hit.at < CACHE_MS) {
        if (hit.repo) featured.push(hit.repo);
        else console.warn(`[github-pinned] featured "${entry}": no such repo ${owner}/${name}`);
        continue;
      }
      try {
        const repo = await fetchRepo(owner, name);
        cache.repos[key] = { at: now, repo };
        dirty = true;
        if (repo) featured.push(repo);
        else console.warn(`[github-pinned] featured "${entry}": no such repo ${owner}/${name}`);
      } catch (err) {
        console.warn(`[github-pinned] couldn't load ${owner}/${name}: ${(err as Error).message}`);
        if (hit?.repo) featured.push(hit.repo);
      }
    }

    if (dirty) {
      try {
        mkdirSync(resolve('node_modules/.cache'), { recursive: true });
        writeFileSync(cacheFile, JSON.stringify(cache));
      } catch {
        /* cache is optional */
      }
    }
    return { pinned, featured };
  }

  return {
    name: 'nyx-github-pinned',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return;
      this.addWatchFile(resolve('site.config.json'));
      const { pinned, featured } = await load();
      return `export default ${JSON.stringify(pinned)};\nexport const featuredRepos = ${JSON.stringify(featured)};`;
    },
    // Editing site.config.json re-runs the lookup in dev.
    handleHotUpdate({ file, server }) {
      if (file !== resolve('site.config.json')) return;
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (mod) server.moduleGraph.invalidateModule(mod);
    },
  };
}
