// @icons expand_less
import { Button, IconButton } from '../components/button';
import { ProjectArt, ProjectCard, ProjectLinks, StarButton, type CardVariant } from '../components/project-card';
import { openProjectDetail } from '../components/project-detail';
import { Tag } from '../components/chip';
import { projectsGrid, type Project } from '../content';
import { h, icon } from '../lib/dom';
import { prefersReducedMotion } from '../theme/motion';
import { store } from '../state';
import { Section, SectionHeader } from './section-header';

/** M3 carousel (hero layout): one large item with the next one peeking in. */
function Carousel(onOpen: (p: Project, el: HTMLElement) => void) {
  const track = h('div', { class: 'carousel', tabindex: '0', role: 'group', 'aria-roledescription': 'carousel', 'aria-label': 'Featured projects' });
  const prev = IconButton({ icon: 'chevron_left', label: 'Previous featured project', variant: 'outlined', tooltip: 'top' });
  const next = IconButton({ icon: 'chevron_right', label: 'Next featured project', variant: 'outlined', tooltip: 'top' });
  const root = h('div', { class: 'mb-8' },
    h('div', { class: 'flex items-center gap-2 mb-3' },
      h('h3', { class: 'text-title-md text-on-surface-variant flex-1' }, 'Featured'),
      prev, next),
    track);

  const step = (dir: number) => {
    const item = track.querySelector<HTMLElement>('.carousel-item');
    if (!item) return;
    track.scrollBy({ left: dir * (item.offsetWidth + 8), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));

  // Items further from the leading edge fade their text, like M3's keyline masking.
  const onScroll = () => {
    const tr = track.getBoundingClientRect();
    for (const item of track.children as HTMLCollectionOf<HTMLElement>) {
      const r = item.getBoundingClientRect();
      const visible = Math.max(0, Math.min(r.right, tr.right) - Math.max(r.left, tr.left)) / r.width;
      const content = item.querySelector<HTMLElement>('.carousel-content');
      if (content) content.style.opacity = String(Math.max(0, Math.min(1, (visible - 0.45) / 0.4)));
      item.inert = visible < 0.5;
    }
    prev.toggleAttribute('disabled', track.scrollLeft < 4);
    next.toggleAttribute('disabled', track.scrollLeft + track.clientWidth > track.scrollWidth - 4);
  };
  track.addEventListener('scroll', () => requestAnimationFrame(onScroll), { passive: true });
  new ResizeObserver(onScroll).observe(track);

  const render = (items: Project[]) => {
    root.hidden = items.length === 0;
    prev.hidden = next.hidden = items.length < 2;
    track.replaceChildren(
      ...items.map((p, i) => {
        const open = h('button', { class: 'card-primary text-left', type: 'button', 'aria-haspopup': 'dialog' }, p.title);
        const art = ProjectArt(p, { large: true, tone: i % 2 ? 'secondary' : 'primary' });
        art.classList.add('!absolute', '!inset-0', '!m-0', '!aspect-auto', '!rounded-none');
        const item = h(
          'article',
          { class: 'carousel-item card interactive', 'aria-roledescription': 'slide', 'aria-label': `${i + 1} of ${items.length}: ${p.title}` },
          art,
          h('span', { class: 'state-layer', 'aria-hidden': 'true' }),
          h('div', { class: 'carousel-content absolute inset-x-0 bottom-0 p-4 medium:p-6 bg-linear-to-t from-surface-container-lowest/85 via-surface-container-lowest/60 to-transparent pt-16 text-on-surface' },
            h('div', { class: 'flex items-end gap-3' },
              h('div', { class: 'flex-1 min-w-0' },
                h('h4', { class: 'text-headline-sm medium:text-headline-md', style: 'font-weight:500' }, open),
                h('p', { class: 'mt-1 text-body-md text-on-surface-variant line-clamp-2 max-w-[48ch]' }, p.description),
                h('div', { class: 'mt-3 flex flex-wrap gap-1.5' }, p.tech.map((t) => Tag(t, store.filters.has(t)))),
              ),
              h('div', { class: 'card-actions flex gap-1' }, StarButton(p), ProjectLinks(p)),
            ),
          ),
        );
        open.addEventListener('click', () => onOpen(p, item));
        return item;
      }),
    );
    requestAnimationFrame(onScroll);
  };
  return { root, render };
}

function variantFor(p: Project): CardVariant {
  if (p.highlight) return 'elevated';
  // Projects from site.config.json get filled cards; auto-imported GitHub repos are outlined.
  return p.fromGithub ? 'outlined' : 'filled';
}

export function Projects() {
  const onOpen = (p: Project, el: HTMLElement) => openProjectDetail(p, el);
  const carousel = Carousel(onOpen);
  const grid = h('div', { class: 'grid gap-3 medium:grid-cols-2 large:grid-cols-3', role: 'list' });
  const empty = h(
    'div',
    { class: 'empty-state rounded-xl bg-surface-container-low p-8 flex flex-col items-center text-center gap-3', hidden: true },
    h('span', { class: 'shape-icon shape-softBurst bg-secondary-container text-on-secondary-container size-16', 'aria-hidden': 'true' }, icon('search_off')),
    h('p', { class: 'text-title-md' }, 'Nothing here with that stack yet'),
    h('p', { class: 'text-body-md text-on-surface-variant' }, 'Try a different combination of chips.'),
    Button({ label: 'Clear filters', variant: 'tonal', onClick: () => store.clearFilters() }),
  );
  const githubNote = h('p', { class: 'mt-4 text-body-sm text-on-surface-variant flex items-center gap-1.5', hidden: true },
    icon('sync', { class: 'icon-sm' }), 'Outlined cards are pulled live from GitHub.');

  const gridTitle = h('h3', { class: 'text-title-md text-on-surface-variant mb-3' }, 'All projects');

  // Only the first few rows show until "Show more" is pressed.
  const columnQueries = [window.matchMedia('(min-width: 1200px)'), window.matchMedia('(min-width: 600px)')];
  const columns = () => (columnQueries[0].matches ? 3 : columnQueries[1].matches ? 2 : 1);
  let expanded = false;
  const moreLabel = h('span');
  const moreIcon = icon('expand_more');
  const more = h('button', { class: 'btn btn--tonal interactive', type: 'button', 'aria-controls': 'projects-grid', 'aria-expanded': 'false' },
    h('span', { class: 'state-layer', 'aria-hidden': 'true' }), moreIcon, moreLabel);
  const moreRow = h('div', { class: 'mt-4 flex justify-center', hidden: true }, more);
  grid.id = 'projects-grid';

  let cards = new Map<string, { el: HTMLElement; renderTags: () => void }>();
  let renderedFor = '';

  const render = () => {
    const featured = store.projects.filter((p) => p.featured);
    const rest = store.projects.filter((p) => !p.featured);
    const key = store.projects.map((p) => p.id).join('|');

    if (key !== renderedFor) {
      renderedFor = key;
      cards = new Map();
      grid.replaceChildren(
        ...rest.map((p) => {
          const c = ProjectCard(p, variantFor(p), onOpen);
          c.el.setAttribute('role', 'listitem');
          cards.set(p.id, c);
          return c.el;
        }),
      );
      githubNote.hidden = !rest.some((p) => variantFor(p) === 'outlined');
    }

    carousel.render(featured.filter((p) => store.matches(p)));
    let shown = 0;
    const limit = Math.max(1, projectsGrid.initialRows) * columns();
    for (const p of rest) {
      const c = cards.get(p.id)!;
      const match = store.matches(p);
      if (match) shown++;
      c.el.dataset.hidden = String(!match || (!expanded && shown > limit));
      c.renderTags();
    }
    const extra = shown - limit;
    moreRow.hidden = extra <= 0;
    more.setAttribute('aria-expanded', String(expanded));
    moreIcon.textContent = expanded ? 'expand_less' : 'expand_more';
    moreLabel.textContent = expanded ? 'Show less' : `Show ${extra} more`;
    const featuredShown = featured.filter((p) => store.matches(p)).length;
    grid.hidden = gridTitle.hidden = shown === 0;
    if (shown === 0) moreRow.hidden = true;
    githubNote.hidden = shown === 0 || !rest.some((p) => variantFor(p) === 'outlined' && store.matches(p));
    empty.hidden = shown + featuredShown > 0;
  };
  store.subscribe(render);
  render();
  columnQueries.forEach((q) => q.addEventListener('change', render));

  more.addEventListener('click', () => {
    const wasHidden = new Set([...grid.children].filter((el) => (el as HTMLElement).dataset.hidden === 'true'));
    expanded = !expanded;
    render();
    if (expanded) {
      // Fade the newly revealed cards in, a few at a time.
      const revealed = [...grid.children].filter((el) => wasHidden.has(el) && (el as HTMLElement).dataset.hidden === 'false') as HTMLElement[];
      if (!prefersReducedMotion()) {
        revealed.forEach((el, i) =>
          el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], {
            duration: 400, delay: Math.min(i, 8) * 40, easing: 'cubic-bezier(0.05, 0.7, 0.1, 1)', fill: 'backwards',
          }));
      }
      revealed[0]?.querySelector<HTMLElement>('.card-primary')?.focus({ preventScroll: true });
    } else {
      gridTitle.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
  });

  return Section(
    'projects',
    SectionHeader({
      id: 'projects',
      title: 'Projects',
      supporting: 'Apps, games and websites — all open source. Open a card for details.',
      icon: 'deployed_code',
      shape: 'cookie9',
    }),
    carousel.root,
    gridTitle,
    grid,
    moreRow,
    empty,
    githubNote,
  );
}
