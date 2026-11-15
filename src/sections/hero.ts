import { Button, IconButton } from '../components/button';
import { showSnackbar } from '../components/snackbar';
import { Visor, expressionLabels, visor } from '../components/visor';
import { DiscordPresenceChip, DiscordStatusDot } from '../components/discord-card';
import { site, visorConfig } from '../content';
import { h, s, srOnly } from '../lib/dom';
import { prefersReducedMotion, spring } from '../theme/motion';
import { shapeSvgPoints } from '../theme/shapes';

const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

/** Loads an image and resolves only if it really decodes (missing files fall back to the placeholder). */
function tryImage(src: string, attrs: Record<string, string>): Promise<HTMLImageElement> {
  const img = h('img', { src, ...attrs });
  return img.decode().then(() => img);
}

/** Tonal, flat-shape illustration used until /public/banner.png exists. */
function BannerPlaceholder() {
  const svg = s(
    'svg',
    { viewBox: '0 0 1500 500', preserveAspectRatio: 'xMidYMid slice', class: 'w-full h-full block', 'aria-hidden': 'true' },
    s('rect', { width: 1500, height: 500, fill: 'var(--md-sys-color-surface-container-high)' }),
    s('polygon', { points: shapeSvgPoints('cookie12', 1190, 210, 520, 8), fill: 'var(--md-sys-color-primary-container)' }),
    s('polygon', { points: shapeSvgPoints('clover4', 870, 470, 300, 20), fill: 'var(--md-sys-color-secondary-container)' }),
    s('polygon', { points: shapeSvgPoints('softBurst', 1420, 450, 180, 0), fill: 'var(--md-sys-color-tertiary-container)' }),
    s('polygon', { points: shapeSvgPoints('flower', 600, 60, 200, 10), fill: 'var(--md-sys-color-surface-container-highest)' }),
  );
  // A dot-matrix field, nodding to the visor.
  const dots = s('g', { fill: 'var(--md-sys-color-outline-variant)' });
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 16; x++) {
      if ((x + y) % 2) continue;
      dots.appendChild(s('circle', { cx: 60 + x * 26, cy: 60 + y * 26, r: 4 }));
    }
  }
  svg.appendChild(dots);
  return svg;
}

function PfpPlaceholder() {
  return h(
    'span',
    { class: 'text-display-md font-semibold text-on-primary-container select-none', style: 'font-variation-settings:"ROND" 100', 'aria-hidden': 'true' },
    site.name.charAt(0),
  );
}

const boopLines = ['ggughueguheghdgjhdgjegierjhgirebhrgehurvei', 'aa', 'aaa', 'aaaa', 'aaaaa'];

function Pfp() {
  const face = h('span', { class: 'pfp-face' }, PfpPlaceholder());
  const ring = h('span', { class: 'pfp-ring' });
  const altText = srOnly(site.assets.pfpAlt);
  const btn = h('button', { class: 'pfp', type: 'button' }, ring, face, altText, srOnly(' (boop)'));

  tryImage(asset(site.assets.pfp), { alt: site.assets.pfpAlt, width: '512', height: '512', decoding: 'async' })
    .then((img) => {
      face.replaceChildren(img);
      altText.remove();
    })
    .catch(() => {});

  let boops = 0;
  btn.addEventListener('click', () => {
    boops++;
    visor.flash('startled', 1300);
    showSnackbar(boops > 9 ? 'no' : boopLines[(boops - 1) % boopLines.length], { duration: 2200 });
    if (prefersReducedMotion()) return;
    const sp = spring('fast-spatial');
    btn.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.14, 0.84)' }],
      { duration: 90, easing: 'cubic-bezier(0.3, 0, 0.8, 0.15)', fill: 'forwards' },
    ).finished.then(() => {
      btn.animate([{ transform: 'scale(1.14, 0.84)' }, { transform: 'scale(1)' }], { duration: sp.duration * 1.6, easing: sp.easing, fill: 'forwards' });
    });
    for (const el of [ring, face]) {
      el.style.clipPath = 'var(--shape-softBurst)';
      setTimeout(() => (el.style.clipPath = ''), 420);
    }
  });
  return btn;
}

function VisorDock() {
  const status = h('span', null, expressionLabels.idle);
  visor.onChange((expr) => (status.textContent = expressionLabels[expr]));

  const replay = IconButton({
    icon: 'replay',
    label: 'Replay visor greeting',
    tooltip: 'top',
    onClick: () => visor.marquee(site.visorGreeting),
  });

  const screen = Visor('hero');
  screen.addEventListener('click', () => visor.flash('happy', 1200));

  return h(
    'figure',
    { class: 'rounded-xl bg-surface-container-low p-3 pb-2 medium:p-4 medium:pb-2' },
    screen,
    h(
      'figcaption',
      { class: 'flex items-center gap-2 pt-2 pl-2' },
      h('span', { class: 'size-2 rounded-full bg-tertiary', 'aria-hidden': 'true' }),
      h('span', { class: 'text-label-md text-on-surface-variant uppercase tracking-[0.12em]', 'aria-hidden': 'true' }, 'Visor · ', status),
      srOnly(`Nyx’s LED visor. It scrolls the text “${site.visorGreeting}” and changes expression as you browse.`),
      h('span', { class: 'flex-1' }),
      replay,
    ),
  );
}

export function Hero(onSeeProjects: (e: MouseEvent) => void) {
  const media = h('div', { class: 'banner-media' }, BannerPlaceholder());
  const banner = h('div', { class: 'banner' }, media, h('div', { class: 'banner-scrim' }));

  tryImage(asset(site.assets.banner), { alt: '', width: '1500', height: '500', fetchpriority: 'high', decoding: 'async' })
    .then((img) => media.replaceChildren(img))
    .catch(() => {});

  // Subtle parallax while the banner is on screen.
  if (!prefersReducedMotion()) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const y = Math.min(window.scrollY, 600);
        media.style.transform = `translate3d(0, ${(y * 0.12).toFixed(1)}px, 0)`;
      });
    }, { passive: true });
  }

  const github = site.socials.find((x) => x.label === 'GitHub');
  const others = site.socials.filter((x) => x !== github);

  const name = h('h1', { id: 'home-title', class: 'hero-name text-display-md medium:text-display-lg w-fit' }, site.name);

  const info = h(
    'div',
    { class: 'min-w-0' },
    h('div', { class: '-mt-14 expanded:-mt-20 ml-3 medium:ml-6 relative z-10 w-fit' }, Pfp(), DiscordStatusDot()),
    h('div', { class: 'mt-3 medium:px-2' },
      name,
      h('p', { class: 'mt-1 text-title-md text-on-surface-variant' },
        [site.handle, site.role, site.location].filter(Boolean).join(' · ')),
      DiscordPresenceChip(),
      h('p', { class: 'mt-4 text-body-lg max-w-[56ch]' }, site.bio),
      h('div', { class: 'mt-6 flex flex-wrap items-center gap-2' },
        Button({ label: 'See my projects', icon: 'arrow_downward', variant: 'filled', size: 'md', href: '#projects', onClick: onSeeProjects }),
        github ? Button({ label: 'GitHub', icon: 'code', variant: 'tonal', size: 'md', href: github.href }) : null,
        h('div', { class: 'flex items-center gap-1 ml-1' },
          others.map((x) => IconButton({ icon: x.icon, label: x.label, href: x.href })),
          site.email ? IconButton({ icon: 'alternate_email', label: 'Email', href: `mailto:${site.email}` }) : null,
        ),
      ),
    ),
  );

  return h(
    'section',
    { id: 'home', class: 'pt-2 pb-6 scroll-mt-24', 'aria-labelledby': 'home-title' },
    banner,
    visorConfig.enabled
      ? h('div', { class: 'grid gap-6 expanded:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] expanded:items-start' },
          info,
          h('div', { class: 'expanded:-mt-10 relative z-10 w-full max-w-[460px] expanded:max-w-none' }, VisorDock()),
        )
      : info,
  );
}
