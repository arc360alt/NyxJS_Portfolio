import { site } from '../content';
import { h, icon, stateLayer } from '../lib/dom';
import { seedTriad } from '../theme/scheme';
import { getMode, getSeed, isDark, setMode, setSeed, toggleDark, type ThemeMode, getPfpColors } from '../theme/theme';
import { IconButton } from './button';

const centerOf = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** Roving-tabindex radio group with arrow-key support. */
function radioGroup(container: HTMLElement, items: HTMLElement[], onSelect: (i: number, el: HTMLElement) => void) {
  const sync = (active: number) =>
    items.forEach((el, i) => {
      el.setAttribute('aria-checked', String(i === active));
      el.tabIndex = i === active ? 0 : -1;
    });
  items.forEach((el, i) => el.addEventListener('click', () => onSelect(i, el)));
  container.addEventListener('keydown', (e) => {
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + items.length) % items.length;
    items[next].focus();
    onSelect(next, items[next]);
  });
  return sync;
}

/** Android-style wallpaper swatches that regenerate the whole scheme. */
export function WallpaperSwatches(opts: { label?: string; stacked?: boolean } = {}) {
  // Re-renders if pfp colors arrive after load (browser fallback in theme.ts).
  const host = h('div', { class: 'contents' });
  let cleanup = () => {};
  const render = () => {
    cleanup();
    const r = renderSwatches(opts);
    host.replaceChildren(r.group);
    cleanup = r.cleanup;
  };
  render();
  window.addEventListener('pfpcolors', render);
  return host;
}

function renderSwatches(opts: { label?: string; stacked?: boolean }) {
  const fromPfp = getPfpColors().map((w) => ({ ...w, pfp: true }));
  const basic = site.wallpapers
    .filter((w) => !fromPfp.some((p) => p.seed.toLowerCase() === w.seed.toLowerCase()))
    .map((w) => ({ ...w, pfp: false }));
  const all = [...fromPfp, ...basic];

  const swatches = all.map((w) => {
    const [p, s, t] = seedTriad(w.seed);
    const label = w.pfp ? `${w.name}, from profile picture` : w.name;
    return h(
      'button',
      {
        class: 'swatch interactive',
        type: 'button',
        role: 'radio',
        'aria-label': label,
        'data-tooltip': w.pfp ? `${w.name} · from pfp` : w.name,
        style: `--sw-p:${p};--sw-s:${s};--sw-t:${t}`,
      },
      stateLayer(),
      h('span', { class: 'swatch-disc', 'aria-hidden': 'true' }),
      icon('check', { class: 'swatch-check' }),
    );
  });
  const pfpSwatches = swatches.slice(0, fromPfp.length);
  const basicSwatches = swatches.slice(fromPfp.length);
  const heading = (text: string) => h('p', { class: 'text-label-md text-on-surface-variant px-1 pt-1 pb-1', 'aria-hidden': 'true' }, text);
  const row = (items: HTMLElement[]) => h('div', { class: 'flex flex-wrap gap-1' }, items);

  const group = opts.stacked
    ? h('div', { class: 'flex flex-col', role: 'radiogroup', 'aria-label': opts.label ?? 'Theme color' },
        pfpSwatches.length ? [heading('From your pfp'), row(pfpSwatches)] : null,
        basicSwatches.length ? [heading('Basic colors'), row(basicSwatches)] : null)
    : h('div', { class: 'flex flex-wrap items-center gap-1', role: 'radiogroup', 'aria-label': opts.label ?? 'Theme color' },
        pfpSwatches,
        pfpSwatches.length && basicSwatches.length ? h('span', { class: 'w-px h-6 mx-1 bg-outline-variant', 'aria-hidden': 'true' }) : null,
        basicSwatches);
  const sync = radioGroup(group, swatches, (i, el) => {
    setSeed(all[i].seed, centerOf(el));
  });
  const update = () => sync(all.findIndex((w) => w.seed.toLowerCase() === getSeed().toLowerCase()));
  update();
  window.addEventListener('themechange', update);
  return { group, cleanup: () => window.removeEventListener('themechange', update) };
}

/** Palette icon button that opens a small menu of wallpaper swatches. */
export function WallpaperMenu() {
  const menuId = 'wallpaper-menu';
  const menu = h(
    'div',
    { class: 'menu right-0 top-[calc(100%+4px)] w-max px-3 pt-2 pb-3 [&_.flex-wrap]:flex-nowrap', id: menuId, hidden: true, role: 'dialog', 'aria-label': 'Theme color' },
    WallpaperSwatches({ stacked: true }),
  );
  const button = IconButton({ icon: 'palette', label: 'Theme color' });
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', menuId);
  button.setAttribute('aria-haspopup', 'dialog');
  const wrap = h('div', { class: 'relative' }, button, menu);

  const close = (refocus = false) => {
    if (menu.hidden) return;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (refocus) button.focus();
  };
  button.addEventListener('click', () => {
    if (!menu.hidden) return close();
    menu.hidden = false;
    menu.classList.remove('is-entering');
    void menu.offsetWidth;
    menu.classList.add('is-entering');
    button.setAttribute('aria-expanded', 'true');
    menu.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!wrap.contains(e.target as Node)) close();
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close(true);
  });
  wrap.addEventListener('focusout', (e) => {
    if (!wrap.contains(e.relatedTarget as Node)) close();
  });
  return wrap;
}

/** Light/dark toggle for the top app bar. */
export function ThemeToggle() {
  const btn = IconButton({
    icon: isDark() ? 'light_mode' : 'dark_mode',
    label: isDark() ? 'Switch to light theme' : 'Switch to dark theme',
    onClick: () => toggleDark(centerOf(btn)),
  });
  window.addEventListener('themechange', () => {
    btn.querySelector('.icon')!.textContent = isDark() ? 'light_mode' : 'dark_mode';
    const label = isDark() ? 'Switch to light theme' : 'Switch to dark theme';
    btn.setAttribute('aria-label', label);
    btn.dataset.tooltip = label;
  });
  return btn;
}

/** M3 segmented button: Light / System / Dark. */
export function ThemeModeSegmented() {
  const modes: { mode: ThemeMode; label: string; icon: string }[] = [
    { mode: 'light', label: 'Light', icon: 'light_mode' },
    { mode: 'system', label: 'Auto', icon: 'brightness_auto' },
    { mode: 'dark', label: 'Dark', icon: 'dark_mode' },
  ];
  const segments = modes.map((m) =>
    h(
      'button',
      { class: 'segment interactive', type: 'button', role: 'radio', 'aria-label': `${m.label} theme` },
      stateLayer(),
      icon(m.icon),
      h('span', { class: 'hidden medium:inline' }, m.label),
    ),
  );
  const group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Theme' }, segments);
  const sync = radioGroup(group, segments, (i, el) => setMode(modes[i].mode, centerOf(el)));
  const update = () => sync(modes.findIndex((m) => m.mode === getMode()));
  update();
  window.addEventListener('themechange', update);
  return group;
}
