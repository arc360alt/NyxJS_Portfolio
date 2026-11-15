/**
 * M3 Expressive shapes as CSS `clip-path: polygon()` values.
 *
 * Every shape is sampled with the same number of points from the same starting
 * angle, so the browser can interpolate any shape into any other — that's what
 * makes the hover/press morphs work with a plain CSS transition.
 */

const POINTS = 120;

/** Radius (0..1, where 1 touches the bounding box) as a function of angle. */
type RadiusFn = (theta: number) => number;

/** Smooth lobes with rounded valleys, like the M3 cookie/scallop shapes. */
const scallop = (lobes: number, depth: number): RadiusFn => (t) => 1 - depth * (1 - Math.cos(lobes * t)) / 2;

/** Lobes with a sharper valley (|cos|^p) — clovers and flowers. */
const clover = (lobes: number, depth: number, sharp = 0.6): RadiusFn => (t) =>
  1 - depth + depth * Math.pow(Math.abs(Math.cos((lobes / 2) * t)), sharp);

const superellipse = (n: number): RadiusFn => (t) =>
  Math.pow(Math.pow(Math.abs(Math.cos(t)), n) + Math.pow(Math.abs(Math.sin(t)), n), -1 / n);

export const shapeFns = {
  circle: () => 1,
  cookie4: scallop(4, 0.12),
  cookie6: scallop(6, 0.1),
  cookie9: scallop(9, 0.08),
  cookie12: scallop(12, 0.07),
  clover4: clover(4, 0.28),
  clover8: clover(8, 0.16),
  softBurst: scallop(10, 0.16),
  sunny: scallop(8, 0.07),
  flower: clover(8, 0.22, 1.4),
  squircle: superellipse(4.2),
} satisfies Record<string, RadiusFn>;

export type ShapeName = keyof typeof shapeFns;

function toPolygon(fn: RadiusFn, rotate = 0): string {
  const pts: string[] = [];
  // Find the max radius so the shape always fills its box.
  let max = 0;
  for (let i = 0; i < POINTS; i++) max = Math.max(max, fn((i / POINTS) * Math.PI * 2));
  for (let i = 0; i < POINTS; i++) {
    const theta = (i / POINTS) * Math.PI * 2;
    const r = (fn(theta) / max) * 50;
    // Start at 12 o'clock so every shape shares the same vertex order.
    const a = theta - Math.PI / 2 + rotate;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)}% ${(50 + r * Math.sin(a)).toFixed(2)}%`);
  }
  return `polygon(${pts.join(',')})`;
}

const cache = new Map<string, string>();

export function shape(name: ShapeName, rotateDeg = 0): string {
  const key = `${name}@${rotateDeg}`;
  let value = cache.get(key);
  if (!value) {
    value = toPolygon(shapeFns[name], (rotateDeg * Math.PI) / 180);
    cache.set(key, value);
  }
  return value;
}

/** Defines `--shape-<name>` on :root so CSS can use `clip-path: var(--shape-cookie12)`. */
export function installShapes() {
  const root = document.documentElement.style;
  for (const name of Object.keys(shapeFns) as ShapeName[]) {
    root.setProperty(`--shape-${name}`, shape(name));
  }
  // A few rotated variants for morph/press states.
  root.setProperty('--shape-cookie12-turn', shape('cookie12', 15));
  root.setProperty('--shape-softBurst-turn', shape('softBurst', 18));
}

/** SVG `points` for a shape centered at (cx, cy) with the given diameter. */
export function shapeSvgPoints(name: ShapeName, cx: number, cy: number, size: number, rotateDeg = 0): string {
  const fn = shapeFns[name] as RadiusFn;
  let max = 0;
  for (let i = 0; i < POINTS; i++) max = Math.max(max, fn((i / POINTS) * Math.PI * 2));
  const rot = (rotateDeg * Math.PI) / 180;
  const pts: string[] = [];
  for (let i = 0; i < POINTS; i++) {
    const theta = (i / POINTS) * Math.PI * 2;
    const r = (fn(theta) / max) * (size / 2);
    const a = theta - Math.PI / 2 + rot;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}
