import { Button } from '../components/button';
import { DiscordCard } from '../components/discord-card';
import { showSnackbar } from '../components/snackbar';
import { visor } from '../components/visor';
import { site } from '../content';
import { discordEnabled } from '../discord';
import { h, icon, stateLayer } from '../lib/dom';
import { Section } from './section-header';

function linkRow(label: string, handle: string | undefined, glyph: string, trailing: HTMLElement) {
  return [
    stateLayer(),
    h('span', { class: 'grid place-items-center size-10 rounded-full bg-primary-container/60 text-on-primary-container', 'aria-hidden': 'true' }, icon(glyph)),
    h('span', { class: 'flex-1 min-w-0' },
      h('span', { class: 'block text-body-lg' }, label),
      handle ? h('span', { class: 'block text-body-md text-on-surface-variant truncate' }, handle) : null,
    ),
    trailing,
  ];
}

const rowClass = 'interactive flex w-full text-left items-center gap-4 rounded-lg px-4 py-3 min-h-[64px]';

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    showSnackbar(done);
  } catch {
    showSnackbar(text);
  }
}

export function Contact() {
  const { discord } = site;
  const links: HTMLElement[] = site.socials.map((s) =>
    h('a', { class: rowClass, href: s.href, target: '_blank', rel: 'noopener noreferrer' }, linkRow(s.label, s.handle, s.icon, icon('arrow_outward', { class: 'text-on-surface-variant' }))),
  );

  // Without a Lanyard user ID there's no profile link, so the Discord row copies the username.
  if (discord.enabled && discord.username && !discordEnabled()) {
    const row = h('button', { class: rowClass, type: 'button', 'aria-label': `Copy Discord username ${discord.username}` },
      linkRow('Discord', `@${discord.username}`, 'forum', icon('content_copy', { class: 'text-on-surface-variant' })));
    row.addEventListener('click', () => copy(discord.username, `Copied “${discord.username}” — add me on Discord!`));
    links.push(row);
  }

  const actions: (HTMLElement | null)[] = site.email
    ? [
        Button({ label: 'Email me', icon: 'mail', variant: 'filled', size: 'md', href: `mailto:${site.email}` }),
        Button({ label: 'Copy address', icon: 'content_copy', variant: 'outlined', size: 'md', onClick: () => copy(site.email, 'Email address copied') }),
      ]
    : discordEnabled()
      ? [Button({ label: 'Message on Discord', icon: 'chat', variant: 'filled', size: 'md', href: `https://discord.com/users/${discord.userId}` })]
      : discord.enabled && discord.username
        ? [Button({ label: `Discord: @${discord.username}`, icon: 'content_copy', variant: 'filled', size: 'md', onClick: () => copy(discord.username, `Copied “${discord.username}”`) })]
        : [];

  const surface = h(
    'div',
    { class: 'rounded-xl bg-secondary-container/50 p-5 medium:p-8 grid gap-6 expanded:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] expanded:items-start' },
    h('div', { class: 'expanded:pt-2' },
      h('span', { class: 'shape-icon shape shape-softBurst bg-tertiary-container text-on-tertiary-container mb-4', 'data-morph': true, 'aria-hidden': 'true' }, icon('waving_hand')),
      h('h2', { id: 'contact-title', class: 'section-title text-headline-md medium:text-headline-lg' }, 'Say hi'),
      h('p', { class: 'mt-2 text-body-lg text-on-surface-variant max-w-[44ch]' },
        'Questions about a project, an idea for an app, or just want to chat? Reach out anywhere below. (My DMs probably arnet open so just join my server instead)'),
      actions.length ? h('div', { class: 'mt-6 flex flex-wrap gap-2' }, actions) : null,
    ),
    h('div', { class: 'flex flex-col gap-3 min-w-0' },
      DiscordCard(),
      links.length
        ? h('nav', { 'aria-label': 'Social links', class: 'rounded-lg bg-surface-container-lowest/70 py-1 text-on-surface' }, links)
        : null,
    ),
  );

  // The visor goes happy while you're here.
  const section = Section('contact', surface);
  section.addEventListener('pointerenter', () => visor.hold('contact', 'happy'));
  section.addEventListener('pointerleave', () => visor.release('contact'));
  section.addEventListener('focusin', () => visor.hold('contact', 'happy'));
  section.addEventListener('focusout', (e) => {
    if (!section.contains(e.relatedTarget as Node)) visor.release('contact');
  });
  return section;
}
