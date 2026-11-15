import { h, icon } from '../lib/dom';
import type { ShapeName } from '../theme/shapes';

interface SectionHeaderOptions {
  id: string;
  title: string;
  supporting?: string;
  icon: string;
  shape: ShapeName;
  tone?: 'primary' | 'secondary' | 'tertiary';
}

const toneClass = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
};

export function SectionHeader(o: SectionHeaderOptions) {
  return h(
    'header',
    { class: 'section-head group flex items-start gap-4 mb-6' },
    h('span', { class: `shape-icon shape shape-${o.shape} ${toneClass[o.tone ?? 'primary']}`, 'data-morph': true, 'aria-hidden': 'true' }, icon(o.icon)),
    h(
      'div',
      { class: 'min-w-0 pt-1' },
      h('h2', { id: `${o.id}-title`, class: 'section-title text-headline-md medium:text-headline-lg' }, o.title),
      o.supporting ? h('p', { class: 'mt-1 text-body-lg text-on-surface-variant max-w-[62ch]' }, o.supporting) : null,
    ),
  );
}

/** Standard section wrapper with an accessible name. */
export function Section(id: string, ...children: (Node | null)[]) {
  return h('section', { id, class: 'py-10 medium:py-14 scroll-mt-20', 'aria-labelledby': `${id}-title` }, children);
}
