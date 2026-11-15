import { Button } from '../components/button';
import { FilterChip } from '../components/chip';
import { stack, stackFromGithub } from '../content';
import { h } from '../lib/dom';
import { store } from '../state';
import { Section, SectionHeader } from './section-header';

export function Stack() {
  const chips = new Map<string, HTMLButtonElement>();

  const groups = stack.map((group, gi) => {
    const labelId = `stack-group-${gi}`;
    return h(
      'div',
      { class: 'flex flex-col gap-3 medium:flex-row medium:items-baseline medium:gap-6' },
      h('h3', { id: labelId, class: 'text-title-sm text-on-surface-variant medium:w-28 flex-none' }, group.label),
      h(
        'div',
        { class: 'flex flex-wrap gap-2', role: 'group', 'aria-labelledby': labelId },
        group.items.map((tech) => {
          const chip = FilterChip({
            label: tech,
            count: store.count(tech),
            selected: store.filters.has(tech),
            onChange: (on) => store.toggleFilter(tech, on),
          });
          chips.set(tech, chip);
          return chip;
        }),
      ),
    );
  });

  const summary = h('p', { class: 'text-body-md text-on-surface-variant', 'aria-live': 'polite' });
  const clear = Button({ label: 'Clear filters', icon: 'filter_alt_off', variant: 'text', onClick: () => store.clearFilters() });

  const sync = () => {
    for (const [tech, chip] of chips) {
      chip.setAttribute('aria-pressed', String(store.filters.has(tech as never)));
      const count = chip.querySelector('.chip-count');
      const n = store.count(tech as never);
      if (count) {
        count.textContent = String(n);
        count.setAttribute('aria-label', `${n} project${n === 1 ? '' : 's'}`);
      }
      // No projects to filter by → no chip (unless it's currently selected).
      chip.hidden = n === 0 && !store.filters.has(tech as never);
    }
    for (const row of groups) {
      // Most-used first, by the count shown on the chip (stable for ties).
      const list = row.querySelector<HTMLElement>('[role=group]')!;
      const sorted = [...list.querySelectorAll<HTMLElement>('.chip')]
        .map((el, i) => ({ el, i, n: Number(el.querySelector('.chip-count')?.textContent ?? 0) }))
        .sort((a, b) => b.n - a.n || a.i - b.i);
      if (sorted.some((c, i) => list.children[i] !== c.el)) list.append(...sorted.map((c) => c.el));
      row.hidden = sorted.every((c) => c.el.hidden);
    }
    const active = [...store.filters];
    const shown = store.projects.filter((p) => store.matches(p)).length;
    summary.textContent = active.length
      ? `Showing ${shown} project${shown === 1 ? '' : 's'} built with ${new Intl.ListFormat('en', { type: 'disjunction' }).format(active)}.`
      : 'Pick a few to filter the projects below.';
    clear.hidden = active.length === 0;
  };
  store.subscribe(sync);
  sync();

  return Section(
    'stack',
    SectionHeader({
      id: 'stack',
      title: 'Stack',
      supporting: stackFromGithub
        ? 'Every language across my GitHub repos, most used first. Select any of them to filter my projects.'
        : 'The languages and tools I reach for. Select any of them to filter my projects.',
      icon: 'stacks',
      shape: 'clover4',
      tone: 'secondary',
    }),
    h(
      'div',
      { class: 'rounded-xl bg-surface-container-low p-4 medium:p-6 flex flex-col gap-5' },
      groups,
      h('div', { class: 'flex flex-wrap items-center justify-between gap-2 min-h-10 pt-1 border-t border-outline-variant/60 -mx-4 px-4 medium:-mx-6 medium:px-6 pt-4' }, summary, clear),
    ),
  );
}
