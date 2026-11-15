import { site, visorConfig } from '../content';
import { h, icon, stateLayer } from '../lib/dom';
import { IconButton } from './button';
import { ThemeToggle, WallpaperMenu } from './theme-controls';
import { Visor } from './visor';

export interface NavDestination {
  id: string;
  label: string;
  icon: string;
}

export const destinations: NavDestination[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'stack', label: 'Stack', icon: 'stacks' },
  { id: 'projects', label: 'Projects', icon: 'deployed_code' },
  { id: 'about', label: 'About', icon: 'person' },
  { id: 'contact', label: 'Contact', icon: 'mail' },
];

function navItem(d: NavDestination, onNavigate: (id: string, e: MouseEvent) => void) {
  const a = h(
    'a',
    { class: 'nav-item interactive', href: `#${d.id}`, 'data-dest': d.id },
    h(
      'span',
      { class: 'nav-indicator' },
      stateLayer(),
      icon(d.icon),
      h('span', { class: 'nav-label nav-label--inline' }, d.label),
    ),
    h('span', { class: 'nav-label nav-label--below' }, d.label),
  );
  a.addEventListener('click', (e) => onNavigate(d.id, e));
  return a;
}

/**
 * Builds both the compact navigation bar and the medium/expanded rail.
 * CSS decides which one is visible for the current window size class.
 */
export function Navigation(onNavigate: (id: string, e: MouseEvent) => void) {
  const bar = h('nav', { class: 'nav-bar', 'aria-label': 'Primary' }, destinations.map((d) => navItem(d, onNavigate)));
  const rail = h('nav', { class: 'nav-rail', 'aria-label': 'Primary' }, destinations.map((d) => navItem(d, onNavigate)));

  const setActive = (id: string | null) => {
    for (const el of [...bar.children, ...rail.children] as HTMLElement[]) {
      if (el.dataset.dest === id) el.setAttribute('aria-current', 'location');
      else el.removeAttribute('aria-current');
    }
  };
  return { bar, rail, setActive };
}

export function TopAppBar(onHome: (e: MouseEvent) => void) {
  const brand = h(
    'a',
    { href: import.meta.env.BASE_URL, class: 'flex items-center gap-3 rounded-full pl-2 pr-3 h-12 interactive', 'aria-label': `${site.name} — home` },
    stateLayer(),
    visorConfig.enabled && visorConfig.showInAppBar ? Visor('mini') : null,
    h('span', { class: 'text-title-lg font-medium', style: 'font-variation-settings:"ROND" 100' }, site.name),
  );
  brand.addEventListener('click', onHome);

  const bar = h(
    'header',
    { class: 'top-app-bar' },
    brand,
    h('div', { class: 'flex-1' }),
    WallpaperMenu(),
    ThemeToggle(),
    IconButton({ icon: 'code', label: 'GitHub', href: site.socials.find((s) => s.label === 'GitHub')?.href ?? 'https://github.com' }),
  );

  const onScroll = () => bar.setAttribute('data-scrolled', String(window.scrollY > 4));
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  return bar;
}
