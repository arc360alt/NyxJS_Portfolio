import { about } from '../content';
import { h, icon } from '../lib/dom';
import type { ShapeName } from '../theme/shapes';
import { Section, SectionHeader } from './section-header';

export function About() {
  const tones = [
    'bg-primary-container text-on-primary-container',
    'bg-secondary-container text-on-secondary-container',
    'bg-primary-container text-on-primary-container',
    'bg-tertiary-container text-on-tertiary-container',
  ];

  const list = h(
    'ul',
    { class: 'rounded-xl bg-surface-container-low py-2 overflow-hidden' },
    about.facts.map((f, i) =>
      h(
        'li',
        { class: 'group flex items-center gap-4 px-4 py-3 min-h-[72px]' },
        h('span', { class: `shape-icon shape shape-${f.shape as ShapeName} ${tones[i % tones.length]}`, 'data-morph': true, 'aria-hidden': 'true' }, icon(f.icon)),
        h('div', { class: 'min-w-0' },
          h('p', { class: 'text-body-lg text-on-surface' }, f.headline),
          h('p', { class: 'text-body-md text-on-surface-variant' }, f.supporting),
        ),
      ),
    ),
  );

  return Section(
    'about',
    SectionHeader({ id: 'about', title: 'About', icon: 'person', shape: 'sunny', tone: 'primary' }),
    h(
      'div',
      { class: 'grid gap-6 expanded:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] expanded:items-start' },
      h('div', { class: 'flex flex-col gap-4 text-body-lg max-w-[62ch]' }, about.paragraphs.map((t) => h('p', null, t))),
      list,
    ),
  );
}
