import { h, icon, stateLayer } from '../lib/dom';

export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated';

interface ButtonOptions {
  label: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  icon?: string;
  /** Renders an <a>. External links open in a new tab. */
  href?: string;
  onClick?: (e: MouseEvent) => void;
  class?: string;
  attrs?: Record<string, string>;
}

const isExternal = (href: string) => /^https?:\/\//.test(href) && !href.startsWith(location.origin);

/** M3 Expressive common button: pill at rest, squarer while pressed. */
export function Button(o: ButtonOptions) {
  const cls = `btn btn--${o.variant ?? 'filled'} ${o.size === 'md' ? 'btn--md' : ''} interactive ${o.class ?? ''}`;
  const children = [stateLayer(), o.icon ? icon(o.icon) : null, h('span', null, o.label)];
  const el = o.href
    ? h('a', {
        class: cls,
        href: o.href,
        ...(isExternal(o.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
        ...o.attrs,
      }, children)
    : h('button', { class: cls, type: 'button', ...o.attrs }, children);
  if (o.onClick) el.addEventListener('click', o.onClick as EventListener);
  return el;
}

interface IconButtonOptions {
  icon: string;
  label: string;
  variant?: 'standard' | 'filled' | 'tonal' | 'outlined';
  href?: string;
  /** Makes it a toggle button (aria-pressed). */
  toggle?: { pressed: boolean; onChange?: (pressed: boolean, e: MouseEvent) => void; iconOn?: string; tone?: 'primary' | 'tertiary' };
  onClick?: (e: MouseEvent) => void;
  tooltip?: boolean | 'top';
  size?: 'sm' | 'lg';
  class?: string;
}

export function IconButton(o: IconButtonOptions) {
  const cls = [
    'icon-btn interactive',
    o.variant && o.variant !== 'standard' ? `icon-btn--${o.variant}` : '',
    o.toggle?.tone === 'tertiary' ? 'icon-btn--tertiary' : '',
    o.size === 'lg' ? 'icon-btn--lg' : '',
    o.class ?? '',
  ].join(' ');
  const glyph = icon(o.toggle?.pressed && o.toggle.iconOn ? o.toggle.iconOn : o.icon);
  const tooltipAttrs = o.tooltip === false ? {} : { 'data-tooltip': o.label, 'data-tooltip-pos': o.tooltip === 'top' ? 'top' : undefined };
  const el = o.href
    ? h('a', {
        class: cls,
        href: o.href,
        'aria-label': o.label,
        ...tooltipAttrs,
        ...(isExternal(o.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
      }, stateLayer(), glyph)
    : h('button', {
        class: cls,
        type: 'button',
        'aria-label': o.label,
        'aria-pressed': o.toggle ? String(o.toggle.pressed) : undefined,
        ...tooltipAttrs,
      }, stateLayer(), glyph);

  el.addEventListener('click', (e) => {
    if (o.toggle) {
      const next = el.getAttribute('aria-pressed') !== 'true';
      el.setAttribute('aria-pressed', String(next));
      if (o.toggle.iconOn) glyph.textContent = next ? o.toggle.iconOn : o.icon;
      o.toggle.onChange?.(next, e as MouseEvent);
    }
    o.onClick?.(e as MouseEvent);
  });
  return el;
}
