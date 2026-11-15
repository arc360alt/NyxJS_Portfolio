import { ThemeModeSegmented, WallpaperSwatches } from '../components/theme-controls';
import { site } from '../content';
import { h } from '../lib/dom';

export function Footer() {
  const github = site.socials.find((s) => s.label === 'GitHub');
  return h(
    'footer',
    { class: 'mt-6 border-t border-outline-variant/70 py-8 flex flex-col gap-6 expanded:flex-row expanded:items-center' },
    h('div', { class: 'flex-1 text-label-sm text-on-surface-variant flex flex-col gap-1' },
      h('p', null, `Made in Chicagoland by ${site.name} · © ${new Date().getFullYear()}`),
      h('p', null,
        'Built with Material 3, Vite and Tailwind CSS. ',
        github ? h('a', { class: 'link-inline', href: github.href, target: '_blank', rel: 'noopener noreferrer' }, 'Source on GitHub') : null,
      ),
    ),
    h('div', { class: 'flex flex-wrap items-center gap-4' },
      ThemeModeSegmented(),
      WallpaperSwatches({ label: 'Theme color (footer)' }),
    ),
  );
}
