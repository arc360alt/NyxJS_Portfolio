import type { Project } from '../content';
import { h, icon, stateLayer } from '../lib/dom';
import { store } from '../state';
import { IconButton } from './button';
import { Tag } from './chip';
import { visor } from './visor';

export type CardVariant = 'elevated' | 'filled' | 'outlined';

/** Deterministic small number from a string, used to vary card artwork. */
export function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const artShapes = ['cookie9', 'clover4', 'softBurst', 'sunny', 'flower', 'cookie6'] as const;

/** Tonal artwork: overlapping M3 shapes and the project's icon (or its screenshot). */
export function ProjectArt(p: Project, opts: { large?: boolean; tone?: 'primary' | 'secondary' } = {}) {
  const n = hash(p.id);
  const tone = opts.tone ?? (n % 2 ? 'secondary' : 'primary');
  const toneStyle =
    tone === 'primary'
      ? 'background: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container)'
      : 'background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container)';
  const a = artShapes[n % artShapes.length];
  const b = artShapes[(n >> 3) % artShapes.length];

  if (p.image) {
    return h('div', { class: 'card-art', style: toneStyle },
      h('img', { src: p.image, alt: '', loading: 'lazy', decoding: 'async', width: '640', height: '280' }));
  }
  const size = opts.large ? 1.6 : 1;
  return h(
    'div',
    { class: 'card-art', style: toneStyle, 'aria-hidden': 'true' },
    h('span', {
      class: 'art-shape art-shape--a',
      style: `width:${150 * size}px;height:${150 * size}px;right:${-20 + (n % 30)}px;top:${-40 + (n % 25)}px;clip-path:var(--shape-${a});background:color-mix(in srgb, currentColor 10%, transparent)`,
    }),
    h('span', {
      class: 'art-shape art-shape--b',
      style: `width:${90 * size}px;height:${90 * size}px;left:${8 + (n % 40)}px;bottom:${-30 + (n % 20)}px;clip-path:var(--shape-${b});background:color-mix(in srgb, currentColor 7%, transparent)`,
    }),
    h('span', { class: 'absolute inset-0 grid place-items-center' },
      h('span', { class: 'grid place-items-center size-16 shape-squircle bg-surface-container-lowest/70 text-current' },
        icon(p.icon ?? 'deployed_code', { class: 'icon-lg', fill: true }))),
  );
}

export function StarButton(p: Project, size: 'sm' | 'lg' = 'sm') {
  const btn = IconButton({
    icon: 'favorite',
    label: `Like ${p.title}`,
    tooltip: false,
    size: size === 'lg' ? 'lg' : undefined,
    toggle: {
      pressed: store.starred.has(p.id),
      tone: 'tertiary',
      onChange: (on) => {
        store.toggleStar(p.id, on);
        if (on) visor.flash('love', 1100);
        btn.querySelector('.icon')?.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
          { duration: 380, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
        );
      },
    },
  });
  btn.addEventListener('pointerenter', () => visor.hold('star', 'love'));
  btn.addEventListener('pointerleave', () => visor.release('star'));
  btn.addEventListener('focus', () => visor.hold('star', 'love'));
  btn.addEventListener('blur', () => visor.release('star'));
  return btn;
}

export function ProjectLinks(p: Project) {
  return [
    p.repo ? IconButton({ icon: 'code', label: `${p.title} source code`, href: p.repo, tooltip: 'top' }) : null,
    p.live ? IconButton({ icon: 'open_in_new', label: `${p.title} live site`, href: p.live, tooltip: 'top' }) : null,
  ];
}

export function ProjectCard(p: Project, variant: CardVariant, onOpen: (p: Project, from: HTMLElement) => void) {
  const tags = h('div', { class: 'flex flex-wrap gap-1.5 mt-3' });
  const card = h(
    'article',
    { class: `card card--${variant} interactive`, 'data-project': p.id },
    stateLayer(),
    ProjectArt(p),
    h(
      'div',
      { class: 'px-4 pt-3 pb-1 flex-1 flex flex-col' },
      h('div', { class: 'flex items-start gap-2' },
        h('h3', { class: 'text-title-lg flex-1 min-w-0' },
          h('button', { class: 'card-primary text-left', type: 'button', 'aria-haspopup': 'dialog' }, p.title)),
      ),
      h('div', { class: 'mt-1.5' },
        h('span', { class: 'badge-oss' }, icon('lock_open_right', { fill: true }), 'Open source')),
      h('p', { class: 'mt-2 text-body-md text-on-surface-variant line-clamp-3' }, p.description),
      tags,
    ),
    h('div', { class: 'card-actions flex items-center gap-1 px-2 pb-2 pt-1' },
      StarButton(p),
      h('span', { class: 'flex-1' }),
      ProjectLinks(p),
    ),
  );

  const renderTags = () => tags.replaceChildren(...p.tech.map((t) => Tag(t, store.filters.has(t))));
  renderTags();

  card.querySelector('.card-primary')!.addEventListener('click', () => onOpen(p, card));
  return { el: card, renderTags };
}
