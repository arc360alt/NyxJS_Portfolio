import { site, type Project } from './content';
import { techFromGithub, titleFromRepo } from './lib/tech';

interface Repo {
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics?: string[];
  fork: boolean;
  archived: boolean;
  stargazers_count: number;
  pushed_at: string;
}

const CACHE_KEY = 'nyx:gh-repos';
const CACHE_MS = 60 * 60 * 1000;

function toProject(r: Repo): Project {
  return {
    id: r.name.toLowerCase(),
    title: titleFromRepo(r.name),
    description: r.description ?? 'An open source project on GitHub.',
    tech: techFromGithub([r.language], r.topics),
    repo: r.html_url,
    live: r.homepage || undefined,
    icon: 'folder_code',
    fromGithub: true,
  };
}

function readCache(username: string): Repo[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, user, repos } = JSON.parse(raw) as { at: number; user: string; repos: Repo[] };
    if (user !== username || Date.now() - at > CACHE_MS) return null;
    return repos;
  } catch {
    return null;
  }
}

/**
 * Public, non-fork, non-archived repos as projects. Resolves to [] on any
 * failure (offline, rate limit, wrong username) so the page never breaks.
 */
export async function fetchRepos(username: string): Promise<Project[]> {
  let repos = readCache(username);
  if (!repos) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=100`, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return [];
      repos = (await res.json()) as Repo[];
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), user: username, repos }));
      } catch {
        /* ignore */
      }
    } catch {
      return [];
    }
  }
  const hidden = new Set(site.github.hide.map((n) => n.toLowerCase()));
  return repos
    .filter((r) => !r.fork && !r.archived && !hidden.has(r.name.toLowerCase()) && r.name.toLowerCase() !== username.toLowerCase())
    .map(toProject);
}
