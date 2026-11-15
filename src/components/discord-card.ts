// @icons forum music_note smart_display sports_esports graphic_eq chat
import { site } from '../content';
import {
  activityImage,
  activityVerb,
  avatarUrl,
  discordEnabled,
  formatDuration,
  onPresence,
  statusLabel,
  type LanyardActivity,
  type LanyardPresence,
} from '../discord';
import { h, icon } from '../lib/dom';
import { Button } from './button';

/** Small status dot (for the profile picture). Hidden until presence loads. */
export function DiscordStatusDot() {
  const label = h('span', { class: 'sr-only' });
  const dot = h('span', { class: 'status-dot', hidden: true, 'data-status': 'offline' }, label);
  if (!discordEnabled() || !site.discord.showStatusOnPfp) return null;
  onPresence((p) => {
    dot.hidden = !p;
    if (!p) return;
    dot.dataset.status = p.discord_status;
    dot.title = `Discord: ${statusLabel[p.discord_status]}`;
    label.textContent = `Discord status: ${statusLabel[p.discord_status]}`;
  });
  return dot;
}

function Media(src: string | null, fallbackIcon: string, alt = '') {
  return src
    ? h('img', { src, alt, width: '56', height: '56', loading: 'lazy', class: 'size-14 rounded-md object-cover flex-none bg-surface-container-high' })
    : h('span', { class: 'size-14 rounded-md grid place-items-center flex-none bg-secondary-container text-on-secondary-container', 'aria-hidden': 'true' }, icon(fallbackIcon));
}

function ActivityRow(a: LanyardActivity) {
  const elapsed = h('span', { class: 'tabular-nums' });
  const tick = () => {
    if (a.timestamps?.end) elapsed.textContent = `${formatDuration(a.timestamps.end - Date.now())} left`;
    else if (a.timestamps?.start) elapsed.textContent = `${formatDuration(Date.now() - a.timestamps.start)} elapsed`;
  };
  tick();
  return {
    tick,
    el: h(
      'div',
      { class: 'flex items-center gap-3' },
      Media(activityImage(a), 'sports_esports', a.assets?.large_text ?? ''),
      h('div', { class: 'min-w-0 flex-1' },
        h('p', { class: 'text-label-sm text-on-surface-variant uppercase tracking-wider' }, `${activityVerb[a.type] ?? 'Playing'}`),
        h('p', { class: 'text-title-sm truncate' }, a.name),
        a.details ? h('p', { class: 'text-body-sm text-on-surface-variant truncate' }, a.details) : null,
        a.state ? h('p', { class: 'text-body-sm text-on-surface-variant truncate' }, a.state) : null,
        a.timestamps?.start || a.timestamps?.end ? h('p', { class: 'text-body-sm text-on-surface-variant' }, elapsed) : null,
      ),
    ),
  };
}

function SpotifyRow(s: NonNullable<LanyardPresence['spotify']>) {
  const bar = h('span', { class: 'progress-bar' });
  const pos = h('span', { class: 'tabular-nums' });
  const len = h('span', { class: 'tabular-nums' }, formatDuration(s.timestamps.end - s.timestamps.start));
  const progress = h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Song progress', 'aria-valuemin': '0', 'aria-valuemax': '100' }, bar);
  const tick = () => {
    const total = s.timestamps.end - s.timestamps.start;
    const done = Math.min(total, Math.max(0, Date.now() - s.timestamps.start));
    const pct = total > 0 ? (done / total) * 100 : 0;
    bar.style.width = `${pct}%`;
    progress.setAttribute('aria-valuenow', String(Math.round(pct)));
    pos.textContent = formatDuration(done);
  };
  tick();
  const title = s.track_id
    ? h('a', { class: 'hover:underline', href: `https://open.spotify.com/track/${s.track_id}`, target: '_blank', rel: 'noopener noreferrer' }, s.song)
    : s.song;
  return {
    tick,
    el: h(
      'div',
      { class: 'flex items-center gap-3' },
      Media(s.album_art_url, 'music_note', `${s.album} cover`),
      h('div', { class: 'min-w-0 flex-1' },
        h('p', { class: 'text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-1' }, icon('graphic_eq', { class: 'icon-sm text-primary' }), 'Listening on Spotify'),
        h('p', { class: 'text-title-sm truncate' }, title),
        h('p', { class: 'text-body-sm text-on-surface-variant truncate' }, `by ${s.artist.replace(/;/g, ',')}`),
        h('div', { class: 'mt-2' }, progress),
        h('div', { class: 'mt-1 flex justify-between text-label-sm text-on-surface-variant' }, pos, len),
      ),
    ),
  };
}

/** Discord presence card for the contact section. Returns null if Lanyard isn't configured. */
export function DiscordCard() {
  if (!discordEnabled()) return null;

  const body = h('div', { class: 'flex flex-col gap-4' },
    h('div', { class: 'h-14 rounded-md bg-surface-container-high animate-pulse', 'aria-hidden': 'true' }));
  const card = h(
    'section',
    { class: 'rounded-lg bg-surface-container-lowest/80 p-4 text-on-surface', 'aria-label': 'Discord status', 'aria-live': 'polite', 'aria-busy': 'true' },
    body,
  );

  let ticks: (() => void)[] = [];
  setInterval(() => ticks.forEach((t) => t()), 1000);

  onPresence((p) => {
    if (!p) return;
    card.setAttribute('aria-busy', 'false');
    ticks = [];
    const user = p.discord_user;
    const name = user.global_name || user.display_name || user.username;
    const custom = p.activities.find((a) => a.type === 4);
    const others = site.discord.showActivity
      ? p.activities.filter((a) => a.type !== 4 && !(a.type === 2 && a.name === 'Spotify'))
      : [];

    const rows: HTMLElement[] = [];
    if (site.discord.showSpotify && p.listening_to_spotify && p.spotify) {
      const r = SpotifyRow(p.spotify);
      ticks.push(r.tick);
      rows.push(r.el);
    }
    for (const a of others.slice(0, 2)) {
      const r = ActivityRow(a);
      ticks.push(r.tick);
      rows.push(r.el);
    }

    const parts: (Node | null)[] = [
      h('div', { class: 'flex items-center gap-3' },
        h('span', { class: 'relative flex-none' },
          h('img', { src: avatarUrl(user), alt: '', width: '48', height: '48', class: 'size-12 rounded-full bg-surface-container-high' }),
          h('span', { class: 'status-dot status-dot--sm', 'data-status': p.discord_status, 'aria-hidden': 'true' })),
        h('div', { class: 'min-w-0 flex-1' },
          h('p', { class: 'text-title-md truncate' }, name),
          h('p', { class: 'text-body-sm text-on-surface-variant truncate' },
            `@${user.username} · ${statusLabel[p.discord_status]}`)),
        icon('forum', { class: 'text-on-surface-variant' }),
      ),
      custom && (custom.state || custom.emoji)
        ? h('p', { class: 'text-body-md text-on-surface-variant -mt-1 rounded-md bg-surface-container px-3 py-2' },
            custom.emoji && !custom.emoji.id ? `${custom.emoji.name} ` : '',
            custom.state ?? '')
        : null,
      rows.length ? h('div', { class: 'flex flex-col gap-4 border-t border-outline-variant/60 pt-4' }, rows) : null,
      // Contact already shows this as its main action when there's no email.
      site.email ? Button({ label: 'Message on Discord', icon: 'chat', variant: 'tonal', href: `https://discord.com/users/${user.id}`, class: 'self-start' }) : null,
    ];
    body.replaceChildren(...parts.filter((n): n is Node => n !== null));
  });

  return card;
}

/**
 * One-line live presence for the hero: status, plus what's playing or running.
 * e.g. "● Online · Listening to Song — Artist"
 */
export function DiscordPresenceChip() {
  if (!discordEnabled()) return null;
  const dot = h('span', { class: 'status-dot status-dot--inline', 'data-status': 'offline', 'aria-hidden': 'true' });
  const glyph = icon('forum', { class: 'icon-sm text-on-surface-variant' });
  const text = h('span', { class: 'truncate' });
  const chip = h(
    'a',
    {
      class: 'presence-chip interactive mt-3',
      href: `https://discord.com/users/${site.discord.userId}`,
      target: '_blank',
      rel: 'noopener noreferrer',
      hidden: true,
    },
    h('span', { class: 'state-layer', 'aria-hidden': 'true' }),
    dot,
    glyph,
    text,
  );

  onPresence((p) => {
    chip.hidden = !p;
    if (!p) return;
    dot.dataset.status = p.discord_status;
    const status = statusLabel[p.discord_status];
    const custom = p.activities.find((a) => a.type === 4);
    const activity = site.discord.showActivity
      ? p.activities.find((a) => a.type !== 4 && !(a.type === 2 && a.name === 'Spotify'))
      : undefined;

    let line = status;
    let glyphName = 'forum';
    if (site.discord.showSpotify && p.listening_to_spotify && p.spotify) {
      line = `${status} · Listening to ${p.spotify.song} — ${p.spotify.artist.split(';')[0]}`;
      glyphName = 'music_note';
    } else if (activity) {
      line = `${status} · ${activityVerb[activity.type] ?? 'Playing'} ${activity.name}`;
      glyphName = activity.type === 3 ? 'smart_display' : 'sports_esports';
    } else if (custom?.state) {
      line = `${status} · ${custom.emoji && !custom.emoji.id ? custom.emoji.name + ' ' : ''}${custom.state}`;
    }
    glyph.textContent = glyphName;
    text.textContent = line;
    chip.setAttribute('aria-label', `Discord: ${line}`);
  });
  return chip;
}
