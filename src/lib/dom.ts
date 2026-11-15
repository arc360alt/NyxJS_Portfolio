type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, unknown> & { class?: string; style?: string };

function append(parent: Node, child: Child) {
  if (child === null || child === undefined || child === false) return;
  if (Array.isArray(child)) child.forEach((c) => append(parent, c));
  else parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
}

function applyProps(el: Element, props: Props | null | undefined) {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.setAttribute('class', String(value));
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
}

/** Tiny hyperscript helper: `h('button', { class: 'btn', onClick }, 'Label')`. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  applyProps(el, props);
  append(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function s<K extends keyof SVGElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  applyProps(el, props);
  append(el, children);
  return el;
}

/** Material Symbols Rounded glyph. Decorative by default. */
export function icon(name: string, opts: { fill?: boolean; class?: string } = {}) {
  return h('span', { class: `icon ${opts.class ?? ''}`.trim(), 'aria-hidden': 'true', 'data-fill': opts.fill ? '1' : undefined }, name);
}

/** The M3 state layer that hover/focus/press overlays and ripples render into. */
export function stateLayer() {
  return h('span', { class: 'state-layer', 'aria-hidden': 'true' });
}

export function srOnly(text: string, props?: Props) {
  return h('span', { class: 'sr-only', ...props }, text);
}

export function qs<T extends Element = HTMLElement>(sel: string, root: ParentNode = document) {
  return root.querySelector<T>(sel);
}
