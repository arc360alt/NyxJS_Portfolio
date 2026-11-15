import { projects as manualProjects, site, type Project, type Tech } from './content';
import { fetchRepos } from './github';
import { storage } from './lib/storage';

type Listener = () => void;

function readStarred(): string[] {
  try {
    const value = JSON.parse(storage.get('nyx:starred') ?? '[]');
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/** Projects (manual + GitHub), the active stack filters, and starred projects. */
class Store {
  projects: Project[] = [...manualProjects];
  filters = new Set<Tech>();
  starred = new Set<string>(readStarred());
  private listeners = new Set<Listener>();

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  toggleFilter(tech: Tech, on: boolean) {
    if (on) this.filters.add(tech);
    else this.filters.delete(tech);
    this.emit();
  }

  clearFilters() {
    this.filters.clear();
    this.emit();
  }

  matches(p: Project) {
    return this.filters.size === 0 || p.tech.some((t) => this.filters.has(t));
  }

  count(tech: Tech) {
    return this.projects.filter((p) => p.tech.includes(tech)).length;
  }

  toggleStar(id: string, on: boolean) {
    if (on) this.starred.add(id);
    else this.starred.delete(id);
    storage.set('nyx:starred', JSON.stringify([...this.starred]));
  }

  async loadGithub() {
    if (!site.github.username || !site.github.fetchRepos) return;
    const repos = await fetchRepos(site.github.username);
    if (!repos.length) return;
    const known = new Set(
      this.projects.flatMap((p) => [p.id.toLowerCase(), p.repo?.toLowerCase().replace(/\/$/, '') ?? '']),
    );
    const fresh = repos.filter((r) => !known.has(r.id.toLowerCase()) && !known.has(r.repo!.toLowerCase()));
    if (!fresh.length) return;
    this.projects = [...this.projects, ...fresh];
    this.emit();
  }
}

export const store = new Store();
