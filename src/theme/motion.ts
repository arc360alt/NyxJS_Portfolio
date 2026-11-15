/** M3 motion tokens and spring easing curves. */

const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
export const prefersReducedMotion = () => reducedQuery.matches;

export const easing = {
  emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  emphasizedDecelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  emphasizedAccelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  standardDecelerate: 'cubic-bezier(0, 0, 0, 1)',
  standardAccelerate: 'cubic-bezier(0.3, 0, 1, 1)',
} as const;

export const duration = {
  short1: 50, short2: 100, short3: 150, short4: 200,
  medium1: 250, medium2: 300, medium3: 350, medium4: 400,
  long1: 450, long2: 500, long3: 550, long4: 600,
} as const;

/**
 * M3 Expressive spring tokens (damping ratio, stiffness). They are converted
 * into CSS `linear()` curves so plain CSS transitions can overshoot like springs.
 */
const springTokens = {
  'fast-spatial': { damping: 0.6, stiffness: 800 },
  'default-spatial': { damping: 0.8, stiffness: 380 },
  'slow-spatial': { damping: 0.8, stiffness: 200 },
  'fast-effects': { damping: 1, stiffness: 3800 },
  'default-effects': { damping: 1, stiffness: 1600 },
} as const;

export type SpringName = keyof typeof springTokens;

interface SpringCurve {
  easing: string;
  duration: number;
}

const curves = {} as Record<SpringName, SpringCurve>;

function buildSpring(damping: number, stiffness: number): SpringCurve {
  const omega = Math.sqrt(stiffness);
  // Time for the envelope to settle within 0.1% of the target.
  const settle = Math.min(1.2, -Math.log(0.001) / (damping * omega));
  const steps = 48;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * settle;
    let x: number;
    if (damping < 1) {
      const wd = omega * Math.sqrt(1 - damping * damping);
      x = 1 - Math.exp(-damping * omega * t) * (Math.cos(wd * t) + ((damping * omega) / wd) * Math.sin(wd * t));
    } else {
      x = 1 - Math.exp(-omega * t) * (1 + omega * t);
    }
    points.push(i === steps ? '1' : x.toFixed(4));
  }
  return { easing: `linear(${points.join(', ')})`, duration: Math.round(settle * 1000) };
}

const supportsLinear = typeof CSS !== 'undefined' && CSS.supports('transition-timing-function', 'linear(0, 1)');

for (const [name, { damping, stiffness }] of Object.entries(springTokens) as [SpringName, { damping: number; stiffness: number }][]) {
  curves[name] = supportsLinear
    ? buildSpring(damping, stiffness)
    : { easing: damping < 1 ? 'cubic-bezier(0.34, 1.4, 0.64, 1)' : easing.emphasizedDecelerate, duration: 400 };
}

export function spring(name: SpringName): SpringCurve {
  return curves[name];
}

/** Exposes springs as `--md-sys-motion-spring-*` and `--md-sys-motion-spring-*-duration`. */
export function installMotionTokens() {
  const root = document.documentElement.style;
  for (const [name, curve] of Object.entries(curves)) {
    root.setProperty(`--md-sys-motion-spring-${name}`, curve.easing);
    root.setProperty(`--md-sys-motion-spring-${name}-duration`, `${curve.duration}ms`);
  }
}

export function onReducedMotionChange(cb: (reduced: boolean) => void) {
  reducedQuery.addEventListener('change', () => cb(reducedQuery.matches));
}
