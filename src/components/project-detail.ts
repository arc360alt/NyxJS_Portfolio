import type { Project } from '../content';
import { h, icon } from '../lib/dom';
import { prefersReducedMotion } from '../theme/motion';
import { Button, IconButton } from './button';
import { Tag } from './chip';
import { ProjectArt, StarButton } from './project-card';
import { visor } from './visor';

/*
 * M3 container transform: the card's container grows into the detail view.
 * The dialog's surface starts at the card's exact rect and radius, the card
 * content fades out in the first ~30%, then the detail content fades in.
 */

const DURATION = 500;
const EASE = 'cubic-bezier(0.2, 0, 0, 1)';

function finalRect() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw < 600) return { left: 0, top: 0, width: vw, height: vh, radius: 0 };
  const width = Math.min(720, vw - 48);
  const height = Math.min(vh - 48, 760);
  return { left: (vw - width) / 2, top: (vh - height) / 2, width, height, radius: 28 };
}

function DetailContent(p: Project, close: () => void) {
  const paragraphs = (p.details ?? p.description).split(/\n\s*\n/).map((t) => h('p', null, t));
  return h(
    'div',
    { class: 'detail-scroll' },
    h('div', { class: 'sticky top-0 z-10 flex items-center gap-1 h-16 px-2 bg-surface-container-high' },
      IconButton({ icon: 'close', label: 'Close', onClick: close, tooltip: false }),
      h('span', { class: 'flex-1' }),
      StarButton(p),
    ),
    h('div', { class: 'px-4 medium:px-6' },
      h('div', { class: 'detail-art rounded-xl overflow-hidden [&_.card-art]:m-0 [&_.card-art]:rounded-xl [&_.card-art]:aspect-[16/8]' }, ProjectArt(p, { large: true })),
      h('div', { class: 'flex flex-wrap items-center gap-2 mt-5' },
        h('span', { class: 'badge-oss' }, icon('lock_open_right', { fill: true }), 'Open source'),
        p.fromGithub ? h('span', { class: 'tag' }, 'From GitHub') : null,
      ),
      h('h2', { id: 'detail-title', class: 'mt-3 text-headline-md medium:text-headline-lg section-title', style: 'font-weight:500' }, p.title),
      h('div', { class: 'mt-3 text-body-lg text-on-surface-variant flex flex-col gap-3 max-w-[60ch]' }, paragraphs),
      h('h3', { class: 'mt-6 text-title-sm text-on-surface-variant' }, 'Built with'),
      h('div', { class: 'mt-2 flex flex-wrap gap-1.5' }, p.tech.map((t) => Tag(t))),
      h('div', { class: 'mt-8 mb-6 flex flex-wrap gap-2' },
        p.repo ? Button({ label: 'View source', icon: 'code', variant: 'filled', href: p.repo }) : null,
        p.live ? Button({ label: 'Open live site', icon: 'open_in_new', variant: 'tonal', href: p.live }) : null,
      ),
    ),
  );
}

export function openProjectDetail(p: Project, card: HTMLElement) {
  const reduced = prefersReducedMotion();
  const dialog = h('dialog', { class: 'detail', 'aria-labelledby': 'detail-title' });
  const surface = h('div', { class: 'detail-surface' });
  // A snapshot of the card that fades out as the container grows.
  const ghost = card.cloneNode(true) as HTMLElement;
  ghost.removeAttribute('data-project');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.setAttribute('inert', '');
  ghost.style.cssText = 'position:absolute;inset:0 auto auto 0;margin:0;box-shadow:none;pointer-events:none;';

  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    dialog.classList.remove('is-open');
    const from = finalRectFor(surface);
    const r = card.getBoundingClientRect();
    const to = { left: r.left, top: r.top, width: r.width, height: r.height, radius: 12 };
    const done = () => {
      dialog.close();
      dialog.remove();
      card.querySelector<HTMLElement>('.card-primary')?.focus({ preventScroll: true });
    };
    if (reduced || r.width === 0) {
      dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150 }).finished.then(done);
      return;
    }
    ghost.style.width = `${r.width}px`;
    ghost.style.height = `${r.height}px`;
    content.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DURATION * 0.3, easing: 'linear', fill: 'forwards' });
    ghost.animate([{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1 }], { duration: DURATION, easing: 'linear', fill: 'forwards' });
    animateRect(surface, from, to).finished.then(done);
  };

  const content = DetailContent(p, close);
  surface.append(ghost, content);
  dialog.append(surface);
  document.body.append(dialog);

  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });

  const start = card.getBoundingClientRect();
  const end = finalRect();
  const place = (r: { left: number; top: number; width: number; height: number; radius: number }) => {
    Object.assign(surface.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      borderRadius: `${r.radius}px`,
    });
  };
  const sizeContent = (r: Rect) => {
    // Content keeps its final size during the morph, so it doesn't reflow; the surface clips it.
    content.style.width = `${r.width}px`;
    content.style.height = `${r.height}px`;
    content.style.flex = 'none';
  };
  place(end);
  sizeContent(end);
  dialog.showModal();
  requestAnimationFrame(() => dialog.classList.add('is-open'));
  visor.flash('happy', 700);

  const onResize = () => {
    if (closing) return;
    const r = finalRect();
    place(r);
    sizeContent(r);
  };
  window.addEventListener('resize', onResize);
  dialog.addEventListener('close', () => window.removeEventListener('resize', onResize));

  if (reduced) {
    ghost.remove();
    dialog.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    return;
  }

  ghost.style.width = `${start.width}px`;
  ghost.style.height = `${start.height}px`;
  ghost.animate([{ opacity: 1 }, { opacity: 0, offset: 0.3 }, { opacity: 0 }], { duration: DURATION, easing: 'linear', fill: 'forwards' });
  content.animate([{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1 }], { duration: DURATION, easing: 'linear', fill: 'backwards' });
  animateRect(surface, { left: start.left, top: start.top, width: start.width, height: start.height, radius: 12 }, end).finished.then((a) => a.cancel(), () => {});
}

function finalRectFor(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height, radius: parseFloat(getComputedStyle(el).borderRadius) || 0 };
}

type Rect = { left: number; top: number; width: number; height: number; radius: number };

function animateRect(el: HTMLElement, from: Rect, to: Rect) {
  const kf = (r: Rect) => ({
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    borderRadius: `${r.radius}px`,
  });
  return el.animate([kf(from), kf(to)], { duration: DURATION, easing: EASE, fill: 'forwards' });
}
