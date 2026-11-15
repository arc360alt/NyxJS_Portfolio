import { prefersReducedMotion } from '../theme/motion';

/**
 * One delegated listener adds an M3 ripple to every `.interactive` element
 * that contains a `.state-layer`.
 */
export function installRipples() {
  document.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || prefersReducedMotion()) return;
    const target = (event.target as Element | null)?.closest<HTMLElement>('.interactive');
    if (!target) return;
    const layer = target.querySelector<HTMLElement>('.state-layer');
    if (!layer) return;

    const rect = layer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const radius = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y));
    const size = radius * 2;

    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x - radius}px`;
    ripple.style.top = `${y - radius}px`;
    layer.appendChild(ripple);

    const grow = ripple.animate([{ transform: 'scale(0.2)' }, { transform: 'scale(1)' }], {
      duration: Math.min(550, 280 + size * 0.6),
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
      fill: 'forwards',
    });

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      // Let the ripple reach a visible size before fading.
      const wait = Math.max(0, 120 - (Number(grow.currentTime) || 0));
      setTimeout(() => {
        ripple
          .animate([{ opacity: getComputedStyle(ripple).opacity }, { opacity: 0 }], { duration: 200, easing: 'linear', fill: 'forwards' })
          .finished.then(() => ripple.remove(), () => ripple.remove());
      }, wait);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    target.addEventListener('pointerleave', release, { once: true });
  });
}
