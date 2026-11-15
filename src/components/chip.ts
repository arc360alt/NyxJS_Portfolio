import { h, icon, stateLayer } from '../lib/dom';

interface FilterChipOptions {
  label: string;
  selected?: boolean;
  count?: number;
  onChange: (selected: boolean) => void;
}

/** M3 filter chip — a toggle button with an animated leading checkmark. */
export function FilterChip(o: FilterChipOptions) {
  const el = h(
    'button',
    { class: 'chip interactive', type: 'button', 'aria-pressed': String(!!o.selected) },
    stateLayer(),
    icon('check', { class: 'chip-check' }),
    h('span', null, o.label),
    o.count !== undefined ? h('span', { class: 'chip-count', 'aria-label': `${o.count} projects` }, String(o.count)) : null,
  );
  el.addEventListener('click', () => {
    const next = el.getAttribute('aria-pressed') !== 'true';
    el.setAttribute('aria-pressed', String(next));
    o.onChange(next);
  });
  return el;
}

/** Non-interactive tech tag shown on cards. */
export function Tag(label: string, match = false) {
  return h('span', { class: `tag ${match ? 'tag--match' : ''}` }, label);
}
