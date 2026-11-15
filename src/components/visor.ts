import { h } from '../lib/dom';
import { prefersReducedMotion } from '../theme/motion';
import { eyes, mouths, textToColumns, type EyeName, type MouthName } from './visor-glyphs';

/*
 * The visor: a dot-matrix LED face drawn on canvas.
 *
 * One shared controller decides which expression is showing (so the big hero
 * visor and the tiny app-bar visor always agree); each <Visor> instance
 * renders it, follows the cursor, and fades its LEDs in and out.
 */

const COLS = 32;
const ROWS = 12;
/** The canvas is 36×16 "pitches" so the grid has a 2-dot margin on every side. */
const PITCH_COLS = 36;
const PITCH_ROWS = 16;
const MOUTH_TOP = 8;

export type Expression = 'idle' | 'happy' | 'love' | 'wince' | 'confused' | 'startled' | 'sleepy' | 'loading' | 'marquee';

interface Face {
  eyes: EyeName;
  mouth: MouthName | null;
  blush: boolean;
}

const faces: Record<Exclude<Expression, 'loading' | 'marquee'>, Face> = {
  idle: { eyes: 'idle', mouth: 'zigzag', blush: false },
  happy: { eyes: 'happy', mouth: 'w', blush: true },
  love: { eyes: 'heart', mouth: 'w', blush: true },
  wince: { eyes: 'wince', mouth: 'open', blush: false },
  confused: { eyes: 'question', mouth: 'wave', blush: false },
  startled: { eyes: 'startled', mouth: 'o', blush: true },
  sleepy: { eyes: 'sleepy', mouth: 'flat', blush: false },
};

export const expressionLabels: Record<Expression, string> = {
  idle: 'idle',
  happy: 'happy',
  love: 'in love',
  wince: 'wince',
  confused: 'confused',
  startled: 'booped!',
  sleepy: 'sleepy',
  loading: 'loading',
  marquee: 'saying hi',
};

// ───────────────────────── Controller ─────────────────────────

type Listener = (expr: Expression) => void;

class VisorController {
  private base: Expression = 'idle';
  private held: { key: string; expr: Expression }[] = [];
  private transient: { expr: Expression; until: number } | null = null;
  private loadingCount = 0;
  private marqueeState: { cols: number[]; start: number; onDone?: () => void } | null = null;
  private listeners = new Set<Listener>();
  private last: Expression = 'idle';
  private nextBlink = performance.now() + 2500;
  blinkStart = -1;

  current(now: number): Expression {
    if (this.transient && now > this.transient.until) this.transient = null;
    let expr: Expression;
    if (this.transient) expr = this.transient.expr;
    else if (this.loadingCount > 0) expr = 'loading';
    else if (this.marqueeState) expr = 'marquee';
    else if (this.held.length) expr = this.held[this.held.length - 1].expr;
    else expr = this.base;
    if (expr !== this.last) {
      this.last = expr;
      this.listeners.forEach((l) => l(expr));
    }
    return expr;
  }

  /** 0 = closed, 1 = open. Blinks are shared so both visors blink together. */
  eyeOpenness(now: number): number {
    if (prefersReducedMotion()) return 1;
    if (this.blinkStart < 0 && now >= this.nextBlink) {
      this.blinkStart = now;
      // Occasionally double-blink.
      this.nextBlink = now + (Math.random() < 0.18 ? 320 : 2600 + Math.random() * 3800);
    }
    if (this.blinkStart < 0) return 1;
    const t = now - this.blinkStart;
    const close = 70, hold = 60, open = 110;
    if (t < close) return 1 - t / close;
    if (t < close + hold) return 0;
    if (t < close + hold + open) return (t - close - hold) / open;
    this.blinkStart = -1;
    return 1;
  }

  setBase(expr: Expression) {
    this.base = expr;
  }

  /** Show `expr` while some UI state is active (hover, focus…). */
  hold(key: string, expr: Expression) {
    this.held = this.held.filter((h) => h.key !== key);
    this.held.push({ key, expr });
  }

  release(key: string) {
    this.held = this.held.filter((h) => h.key !== key);
  }

  /** Flash an expression for a moment. */
  flash(expr: Expression, ms = 900) {
    this.transient = { expr, until: performance.now() + ms };
  }

  loading(on: boolean) {
    this.loadingCount = Math.max(0, this.loadingCount + (on ? 1 : -1));
  }

  marquee(text: string, onDone?: () => void) {
    if (prefersReducedMotion()) {
      onDone?.();
      return;
    }
    this.marqueeState = { cols: textToColumns(text), start: performance.now(), onDone };
  }

  stopMarquee() {
    const done = this.marqueeState?.onDone;
    this.marqueeState = null;
    done?.();
  }

  /** Marquee scroll position, in columns from the right edge. */
  marqueeFrame(now: number): { cols: number[]; offset: number } | null {
    const m = this.marqueeState;
    if (!m) return null;
    const speed = 20; // columns per second
    const travelled = ((now - m.start) / 1000) * speed;
    const offset = COLS - Math.floor(travelled);
    if (offset < -m.cols.length) {
      this.stopMarquee();
      return null;
    }
    return { cols: m.cols, offset };
  }

  onChange(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const visor = new VisorController();

// ───────────────────────── Renderer ─────────────────────────

interface Palette {
  off: string;
  led: string;
  core: string;
  blush: string;
}

let palette: Palette = readPalette();
function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    off: v('--visor-off', '#2a244e'),
    led: v('--visor-led', '#c8bfff'),
    core: v('--visor-led-core', '#f4eeff'),
    blush: v('--visor-blush', '#fd9fcb'),
  };
}

const instances = new Set<VisorView>();
let pointer: { x: number; y: number } | null = null;
let rafId = 0;

function tick(now: number) {
  rafId = 0;
  let any = false;
  for (const v of instances) {
    if (v.visible) {
      v.frame(now);
      any = true;
    }
  }
  if (any) rafId = requestAnimationFrame(tick);
}

function ensureLoop() {
  if (!rafId && !document.hidden) rafId = requestAnimationFrame(tick);
}

let globalsInstalled = false;
function installGlobals() {
  if (globalsInstalled) return;
  globalsInstalled = true;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') pointer = { x: e.clientX, y: e.clientY };
  }, { passive: true });
  document.addEventListener('pointerleave', () => (pointer = null));
  document.addEventListener('visibilitychange', ensureLoop);
  window.addEventListener('themechange', () => {
    palette = readPalette();
    instances.forEach((v) => (v.dirty = true));
  });
}

class VisorView {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private target = new Float32Array(COLS * ROWS);
  private current = new Float32Array(COLS * ROWS);
  private color = new Uint8Array(COLS * ROWS); // 0 = led, 1 = blush
  private lastFrame = performance.now();
  private size = { w: 0, h: 0, dpr: 1 };
  private gaze = { x: 0, y: 0 };
  visible = false;
  dirty = true;

  constructor(private variant: 'hero' | 'mini') {
    this.canvas = h('canvas');
    this.el = h('div', { class: `visor visor--${variant}`, 'aria-hidden': 'true' }, this.canvas);
    this.ctx = this.canvas.getContext('2d')!;

    new ResizeObserver(() => this.resize()).observe(this.el);
    new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) ensureLoop();
    }).observe(this.el);
    instances.add(this);
    installGlobals();
  }

  private resize() {
    const rect = this.el.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.size = { w: rect.width, h: rect.height, dpr };
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.dirty = true;
  }

  private set(x: number, y: number, c = 0, b = 1) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
    const i = y * COLS + x;
    if (b >= this.target[i]) {
      this.target[i] = b;
      this.color[i] = c;
    }
  }

  private drawEyes(name: EyeName, openness: number, gx: number, gy: number) {
    const art = eyes[name] as { rows: string[]; mirror?: boolean; blinks?: boolean };
    const rows = art.rows;
    const hgt = rows.length;
    const w = rows[0].length;
    const y0 = Math.max(0, 1 + Math.floor((5 - hgt) / 2)) + gy;
    const x0 = Math.floor(8 - (w - 1) / 2) + gx;
    const center = (hgt - 1) / 2;
    const blinking = art.blinks && openness < 1;

    for (let r = 0; r < hgt; r++) {
      if (blinking) {
        if (openness < 0.2) {
          if (r !== Math.round(center + 0.5)) continue;
        } else if (Math.abs(r - center) > openness * (hgt / 2)) continue;
      }
      for (let c = 0; c < w; c++) {
        const lit = blinking && openness < 0.2 ? true : rows[r][c] === '#';
        if (!lit) continue;
        const x = x0 + c;
        const y = y0 + r;
        this.set(x, y);
        if (art.mirror === false) {
          // Draw the same glyph again on the right, not reflected.
          this.set(31 - (x0 - gx + w - 1) + c + gx, y);
        } else {
          this.set(31 - x + 2 * gx, y);
        }
      }
    }
  }

  private drawMouth(name: MouthName, gx: number) {
    const cols = mouths[name];
    cols.forEach((v, i) => {
      const offsets = Array.isArray(v) ? v : [v];
      for (const o of offsets) {
        if (o < 0) continue;
        const x = 8 + i;
        this.set(x + gx, MOUTH_TOP + o);
        this.set(31 - x + gx, MOUTH_TOP + o);
      }
    });
  }

  private drawBlush() {
    const pts = [[2, 7], [3, 6], [4, 7], [5, 6], [6, 7], [7, 6]];
    for (const [x, y] of pts) {
      this.set(x, y, 1, 0.9);
      this.set(31 - x, y, 1, 0.9);
    }
  }

  private drawSpinner(now: number) {
    const n = 12;
    const head = prefersReducedMotion() ? 0 : Math.floor(now / 75) % n;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = Math.round(15.5 + Math.cos(a) * 4.6);
      const y = Math.round(5.5 + Math.sin(a) * 4.4);
      const age = (head - i + n) % n;
      this.set(x, y, age === 0 ? 1 : 0, Math.max(0.12, 1 - age / 7));
    }
  }

  private drawMarquee(frame: { cols: number[]; offset: number }) {
    for (let i = 0; i < frame.cols.length; i++) {
      const x = frame.offset + i;
      if (x < 0 || x >= COLS) continue;
      const mask = frame.cols[i];
      for (let y = 0; y < 5; y++) if (mask & (1 << y)) this.set(x, 3 + y);
    }
  }

  private updateGaze() {
    if (!pointer || prefersReducedMotion()) {
      this.gaze = { x: 0, y: 0 };
      return;
    }
    const r = this.el.getBoundingClientRect();
    const dx = (pointer.x - (r.left + r.width / 2)) / Math.max(window.innerWidth / 2, 1);
    const dy = (pointer.y - (r.top + r.height / 2)) / Math.max(window.innerHeight / 2, 1);
    this.gaze = {
      x: Math.max(-1, Math.min(1, Math.round(dx * 2.2))),
      y: Math.max(-1, Math.min(1, Math.round(dy * 2))),
    };
  }

  frame(now: number) {
    const dt = Math.min(64, now - this.lastFrame);
    this.lastFrame = now;
    this.target.fill(0);

    const expr = visor.current(now);
    this.updateGaze();

    if (expr === 'loading') this.drawSpinner(now);
    else if (expr === 'marquee') {
      const m = visor.marqueeFrame(now);
      if (m) this.drawMarquee(m);
    } else {
      const face = faces[expr];
      const gx = expr === 'idle' || expr === 'happy' || expr === 'love' ? this.gaze.x : 0;
      const gy = expr === 'idle' ? this.gaze.y : 0;
      this.drawEyes(face.eyes, visor.eyeOpenness(now), gx, gy);
      if (face.mouth) this.drawMouth(face.mouth, 0);
      if (face.blush) this.drawBlush();
    }

    // LEDs fade on quickly and decay a little slower, like real ones.
    const reduced = prefersReducedMotion();
    const kOn = reduced ? 1 : 1 - Math.exp(-dt / 28);
    const kOff = reduced ? 1 : 1 - Math.exp(-dt / 70);
    let changed = this.dirty;
    for (let i = 0; i < this.current.length; i++) {
      const t = this.target[i];
      const c = this.current[i];
      if (c === t) continue;
      let next = c + (t - c) * (t > c ? kOn : kOff);
      if (Math.abs(next - t) < 0.01) next = t;
      this.current[i] = next;
      changed = true;
    }
    if (changed) this.draw();
    this.dirty = false;
  }

  private draw() {
    const { w, h: height, dpr } = this.size;
    if (!w || !height) return;
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, height);

    const pitch = Math.min(w / PITCH_COLS, height / PITCH_ROWS);
    const ox = (w - pitch * COLS) / 2 + pitch / 2;
    const oy = (height - pitch * ROWS) / 2 + pitch / 2;
    const mini = this.variant === 'mini';
    const r = pitch * (mini ? 0.44 : 0.34);

    // Unlit LEDs, batched into one path.
    ctx.fillStyle = palette.off;
    ctx.beginPath();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.current[y * COLS + x] > 0.6) continue;
        const cx = ox + x * pitch;
        const cy = oy + y * pitch;
        ctx.moveTo(cx + r, cy);
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    // Glow, then lit LEDs, then a hot core.
    for (let pass = 0; pass < (mini ? 1 : 3); pass++) {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const i = y * COLS + x;
          const b = this.current[i];
          if (b <= 0.02) continue;
          const cx = ox + x * pitch;
          const cy = oy + y * pitch;
          const col = this.color[i] === 1 ? palette.blush : palette.led;
          if (mini || pass === 1) {
            ctx.globalAlpha = b;
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
          } else if (pass === 0) {
            ctx.globalAlpha = b * 0.16;
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(cx, cy, pitch * 0.85, 0, Math.PI * 2);
            ctx.fill();
          } else if (b > 0.5 && this.color[i] === 0) {
            ctx.globalAlpha = (b - 0.5) * 1.4;
            ctx.fillStyle = palette.core;
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}

export function Visor(variant: 'hero' | 'mini' = 'hero') {
  return new VisorView(variant).el;
}
