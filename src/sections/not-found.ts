import { Button } from '../components/button';
import { Visor } from '../components/visor';
import { notFound, visorConfig } from '../content';
import { h, icon } from '../lib/dom';

export function NotFound(onHome: (e: MouseEvent) => void) {
  return h(
    'section',
    { class: 'min-h-[70dvh] grid place-items-center py-12', 'aria-labelledby': 'nf-title' },
    h('div', { class: 'w-full max-w-md flex flex-col items-center text-center' },
      visorConfig.enabled
        ? h('div', { class: 'w-full max-w-xs rounded-xl bg-surface-container-low p-3' }, Visor('hero'))
        : h('span', { class: 'shape-icon shape-softBurst size-32 bg-primary-container text-on-primary-container', 'aria-hidden': 'true' },
            icon('question_mark', { class: '!text-[64px]' })),
      h('p', { class: 'mt-8 text-label-lg text-primary tracking-[0.2em]' }, 'ERROR 404'),
      h('h1', { id: 'nf-title', class: 'hero-name mt-2 text-display-sm medium:text-display-md' }, notFound.title),
      h('p', { class: 'mt-3 text-body-lg text-on-surface-variant' }, notFound.body),
      h('div', { class: 'mt-8' },
        Button({ label: 'Take me home', icon: 'home', variant: 'filled', size: 'md', href: import.meta.env.BASE_URL, onClick: onHome })),
    ),
  );
}
