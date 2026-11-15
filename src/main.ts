import './styles/main.css';

import { Navigation, TopAppBar, destinations } from './components/navigation';
import { visor } from './components/visor';
import { site, visorConfig } from './content';
import { h } from './lib/dom';
import { installRipples } from './lib/ripple';
import { About } from './sections/about';
import { Contact } from './sections/contact';
import { Footer } from './sections/footer';
import { Hero } from './sections/hero';
import { NotFound } from './sections/not-found';
import { Projects } from './sections/projects';
import { Stack } from './sections/stack';
import { store } from './state';
import { installMotionTokens, prefersReducedMotion } from './theme/motion';
import { installShapes } from './theme/shapes';
import { initTheme } from './theme/theme';

installShapes();
installMotionTokens();
initTheme();
installRipples();

const BASE = import.meta.env.BASE_URL;
const isHomePath = (path: string) => path === BASE || path === `${BASE}index.html` || `${path}/` === BASE;

// ───────────────────────── Shell ─────────────────────────

const main = h('main', { id: 'main', class: 'mx-auto w-full max-w-[1180px] px-4 medium:px-6 expanded:px-10 outline-none', tabindex: '-1' });
const footerSlot = h('div', { class: 'mx-auto w-full max-w-[1180px] px-4 medium:px-6 expanded:px-10' }, Footer());
const nav = Navigation(onNavigate);
const pane = h('div', { class: 'pane' }, TopAppBar(goHome), main, footerSlot);

document.getElementById('app')!.append(
  h('a', { class: 'skip-link', href: '#main' }, 'Skip to content'),
  nav.rail,
  pane,
  nav.bar,
);

// ───────────────────────── Routing ─────────────────────────

let spy: IntersectionObserver | null = null;
let onHome = false;

function scrollToSection(id: string, focus = true) {
  const el = document.getElementById(id);
  if (!el) return;
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
  if (id === 'home') window.scrollTo({ top: 0, behavior });
  else el.scrollIntoView({ behavior, block: 'start' });
  history.replaceState(null, '', id === 'home' ? BASE : `#${id}`);
  nav.setActive(id);
  if (focus) {
    const heading = el.querySelector<HTMLElement>('h1, h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }
}

function renderHome() {
  onHome = true;
  document.title = `${site.name} · ${site.role}`;
  visor.setBase('idle');
  main.replaceChildren(
    Hero((e) => {
      e.preventDefault();
      scrollToSection('projects');
    }),
    Stack(),
    Projects(),
    About(),
    Contact(),
  );

  spy?.disconnect();
  const visible = new Map<string, boolean>();
  spy = new IntersectionObserver(
    (entries) => {
      for (const e of entries) visible.set(e.target.id, e.isIntersecting);
      const first = destinations.find((d) => visible.get(d.id));
      if (first) nav.setActive(first.id);
    },
    { rootMargin: '-35% 0px -60% 0px' },
  );
  destinations.forEach((d) => {
    const el = document.getElementById(d.id);
    if (el) spy!.observe(el);
  });
  nav.setActive('home');
}

function renderNotFound() {
  onHome = false;
  spy?.disconnect();
  document.title = `Not found · ${site.name}`;
  visor.setBase('confused');
  nav.setActive(null);
  main.replaceChildren(NotFound(goHome));
}

function render() {
  if (isHomePath(location.pathname)) renderHome();
  else renderNotFound();
}

/** Page transition: M3 fade-through, with the visor showing a loading spinner. */
async function navigate(path: string, thenScrollTo?: string) {
  history.pushState(null, '', path);
  visor.loading(true);
  const reduced = prefersReducedMotion();
  if (!reduced) await main.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'cubic-bezier(0.3, 0, 1, 1)', fill: 'forwards' }).finished;
  render();
  window.scrollTo({ top: 0 });
  if (!reduced) {
    main.getAnimations().forEach((a) => a.cancel());
    main.animate([{ opacity: 0, transform: 'scale(0.98)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(0.05, 0.7, 0.1, 1)' });
  }
  setTimeout(() => {
    visor.loading(false);
    if (thenScrollTo) scrollToSection(thenScrollTo);
    else main.focus({ preventScroll: true });
  }, reduced ? 0 : 650);
}

function goHome(e: MouseEvent) {
  e.preventDefault();
  if (onHome) scrollToSection('home', false);
  else navigate(BASE);
}

function onNavigate(id: string, e: MouseEvent) {
  e.preventDefault();
  if (onHome) scrollToSection(id);
  else navigate(BASE, id);
}

window.addEventListener('popstate', render);

// "> <" when a link or button is pressed.
document.addEventListener('pointerdown', (e) => {
  const t = (e.target as Element).closest('a[href], .btn, .icon-btn, .chip');
  if (t && !t.closest('.pfp')) visor.flash('wince', 260);
});

render();
if (onHome) {
  if (location.hash) requestAnimationFrame(() => scrollToSection(location.hash.slice(1), false));
  // Say hi once the page has settled.
  if (visorConfig.enabled) setTimeout(() => visor.marquee(site.visorGreeting), 700);
}
store.loadGithub();
