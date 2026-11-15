// @icons star push_pin folder_code
/**
 * Typed view of /site.config.json. Edit that file, not this one — you shouldn't
 * need to touch any component to change your name, links, projects or the visor.
 */
import pinnedRepos, { featuredRepos } from 'virtual:github-pinned';
import pfpColors from 'virtual:pfp-colors';
import rawConfig from '../site.config.json';
import { sameRepo, techFromGithub, titleFromRepo } from './lib/tech';

/** Tech labels are free-form; chips in `stack` should match the names used on projects. */
export type Tech = string;

export interface Project {
  id: string;
  title: string;
  description: string;
  details?: string;
  tech: Tech[];
  repo?: string;
  live?: string;
  image?: string;
  featured?: boolean;
  /** Elevated card in the grid. */
  highlight?: boolean;
  icon?: string;
  hidden?: boolean;
  /** Set on repos pulled in from the GitHub API. */
  fromGithub?: boolean;
}

export interface Social {
  label: string;
  href: string;
  icon: string;
  handle?: string;
}

/** Shape of site.config.json (see site.config.schema.json for docs). */
interface SiteConfig {
  profile: { name: string; handle?: string; role?: string; location?: string; bio: string; email?: string; banner?: string; pfp?: string; pfpAlt?: string };
  visor?: Partial<{ enabled: boolean; showInAppBar: boolean; greeting: string }>;
  theme?: { source?: 'pfp' | 'seed'; seed?: string; wallpapers?: { name: string; seed: string }[] };
  github?: Partial<{ username: string; featurePinned: boolean; includeOtherRepos: boolean; hideRepos: string[] }>;
  projectsGrid?: Partial<{ initialRows: number }>;
  featured?: string[];
  discord?: Partial<{ enabled: boolean; username: string; userId: string; showActivity: boolean; showSpotify: boolean; showStatusOnPfp: boolean }>;
  socials?: Social[];
  stack?: { label: string; items: Tech[] }[];
  projects: Project[];
  about?: { paragraphs?: string[]; facts?: { icon: string; shape?: string; headline: string; supporting?: string }[] };
  notFound?: { title?: string; body?: string };
}

const config = rawConfig as unknown as SiteConfig;
const profile = config.profile;
const github = { username: '', includeOtherRepos: false, hideRepos: [] as string[], ...config.github };
const discord = {
  enabled: false,
  username: '',
  userId: '',
  showActivity: true,
  showSpotify: true,
  showStatusOnPfp: true,
  ...config.discord,
};

export const visorConfig = { enabled: true, showInAppBar: true, greeting: "HI, I'M NYX", ...config.visor };

export const site = {
  name: profile.name,
  handle: profile.handle ?? '',
  role: profile.role ?? '',
  location: profile.location ?? '',
  bio: profile.bio,
  visorGreeting: visorConfig.greeting,
  email: profile.email ?? '',
  assets: {
    banner: profile.banner ?? 'banner.png',
    pfp: profile.pfp ?? 'pfp.png',
    pfpAlt: profile.pfpAlt ?? `${profile.name}’s profile picture`,
  },
  /** Default theme color: the top color from your pfp, or `theme.seed`. */
  seed: pfpColors[0]?.seed ?? config.theme?.seed ?? '#6B4EFF',
  /** Colors pulled from your pfp at build time (empty if theme.source is "seed"). */
  pfpColors,
  /** "Basic colors" in the palette menu. */
  wallpapers: config.theme?.wallpapers ?? [],
  github: { username: github.username, fetchRepos: github.includeOtherRepos, hide: github.hideRepos },
  discord,
  socials: config.socials ?? [],
};

export const stack: { label: string; items: Tech[] }[] = config.stack ?? [];

type GithubRepo = (typeof pinnedRepos)[number];

const sameId = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const repoName = (url?: string) => url?.replace(/\/+$/, '').split('/').pop()?.toLowerCase();

function projectFromRepo(r: GithubRepo, icon: string): Project {
  return {
    id: r.name.toLowerCase(),
    title: titleFromRepo(r.name),
    description: r.description ?? 'An open source project on GitHub.',
    tech: techFromGithub(r.languages.length ? r.languages : [r.language], r.topics),
    repo: r.url,
    live: r.homepage ?? undefined,
    icon,
    featured: true,
  };
}

/**
 * Which projects go in the Featured carousel, in this order of preference:
 *   1. `featured` in site.config.json — a list of project ids, repo names
 *      ("pronouns") or "owner/repo"; repos not in `projects` are looked up on GitHub.
 *   2. The repos pinned on your GitHub profile (`github.featurePinned`, default on).
 *   3. Projects marked `"featured": true`.
 * Everything else goes in the "All projects" grid.
 */
function buildProjects(): Project[] {
  const listed = config.projects;
  const featured: Project[] = [];

  const add = (p: Project) => {
    if (!featured.some((f) => sameId(f.id, p.id) || sameRepo(f.repo, p.repo))) featured.push(p);
  };

  if (config.featured?.length) {
    for (const entry of config.featured) {
      const key = entry.toLowerCase().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '');
      const name = key.split('/').pop()!;
      const own = listed.find((p) => sameId(p.id, key) || sameId(p.id, name) || (p.repo && (sameRepo(p.repo, `https://github.com/${key}`) || repoName(p.repo) === name)));
      if (own) {
        if (!own.hidden) add({ ...own, featured: true });
        continue;
      }
      const repo = featuredRepos.find((r) => sameId(r.name, name) && (!key.includes('/') || sameId(`${r.owner}/${r.name}`, key)));
      if (repo) add(projectFromRepo(repo, 'star'));
    }
  } else if (github.featurePinned !== false && pinnedRepos.length) {
    for (const r of pinnedRepos) {
      const own = listed.find((p) => sameRepo(p.repo, r.url));
      if (own?.hidden) continue;
      add(own ? { ...own, featured: true, live: own.live ?? r.homepage ?? undefined } : projectFromRepo(r, 'push_pin'));
    }
  } else {
    listed.filter((p) => p.featured && !p.hidden).forEach(add);
  }

  const rest = listed
    .filter((p) => !p.hidden && !featured.some((f) => sameId(f.id, p.id) || sameRepo(f.repo, p.repo)))
    .map((p) => ({ ...p, featured: false }));
  return [...featured, ...rest];
}

export const projects: Project[] = buildProjects();

export const projectsGrid = { initialRows: 2, ...config.projectsGrid };

export const about = {
  paragraphs: config.about?.paragraphs ?? [],
  facts: config.about?.facts ?? [],
};

export const notFound = {
  title: config.notFound?.title ?? 'Signal lost',
  body: config.notFound?.body ?? 'This page doesn’t exist.',
};
