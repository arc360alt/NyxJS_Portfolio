import { h } from '../lib/dom';
import { prefersReducedMotion } from '../theme/motion';
import { Button } from './button';

interface SnackbarOptions {
  action?: { label: string; onClick: () => void };
  duration?: number;
}

let region: HTMLElement | null = null;
let current: { el: HTMLElement; timer: number } | null = null;

function getRegion() {
  if (!region) {
    region = h('div', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    document.body.appendChild(region);
  }
  return region;
}

function dismiss(el: HTMLElement) {
  if (current?.el === el) {
    clearTimeout(current.timer);
    current = null;
  }
  if (prefersReducedMotion()) {
    el.remove();
    return;
  }
  el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'linear', fill: 'forwards' }).finished.then(() => el.remove());
}

/** M3 snackbar: one at a time, inverse surface, auto-dismiss. */
export function showSnackbar(message: string, o: SnackbarOptions = {}) {
  if (current) {
    clearTimeout(current.timer);
    current.el.remove();
    current = null;
  }
  const el = h(
    'div',
    { class: 'snackbar' },
    h('span', { class: 'py-2.5 pr-2' }, message),
    o.action
      ? Button({
          label: o.action.label,
          variant: 'text',
          onClick: () => {
            o.action!.onClick();
            dismiss(el);
          },
        })
      : null,
  );
  getRegion().appendChild(el);
  if (!prefersReducedMotion()) {
    el.animate(
      [
        { opacity: 0, transform: 'translateY(12px) scale(0.92)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 300, easing: 'cubic-bezier(0.05, 0.7, 0.1, 1)' },
    );
  }
  current = { el, timer: window.setTimeout(() => dismiss(el), o.duration ?? 3200) };
}
