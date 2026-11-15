import {
  DynamicScheme,
  Hct,
  MaterialDynamicColors,
  TonalPalette,
  Variant,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities';

/** Hue (HCT) the tertiary role leans toward: the visor's pink "blush". */
const PINK_HUE = 352;

const colors = new MaterialDynamicColors();

function tertiaryHue(primaryHue: number): number {
  // Keep tertiary pink. If the wallpaper itself is pink, swing tertiary to orchid
  // so it still reads as a distinct accent.
  const distance = Math.abs(((primaryHue - PINK_HUE + 540) % 360) - 180);
  return distance < 40 ? 310 : PINK_HUE;
}

/**
 * Builds an M3 tonal-spot scheme from a seed, with secondary nudged toward
 * periwinkle/blue and tertiary pinned to pink.
 */
export function buildScheme(seedHex: string, isDark: boolean): DynamicScheme {
  const source = Hct.fromInt(argbFromHex(seedHex));
  const hue = source.hue;
  return new DynamicScheme({
    sourceColorHct: source,
    variant: Variant.TONAL_SPOT,
    contrastLevel: 0,
    isDark,
    primaryPalette: TonalPalette.fromHueAndChroma(hue, Math.min(Math.max(source.chroma, 40), 64)),
    secondaryPalette: TonalPalette.fromHueAndChroma((hue - 28 + 360) % 360, 30),
    tertiaryPalette: TonalPalette.fromHueAndChroma(tertiaryHue(hue), 44),
    neutralPalette: TonalPalette.fromHueAndChroma(hue, 5),
    neutralVariantPalette: TonalPalette.fromHueAndChroma(hue, 10),
  });
}

/** Returns `--md-sys-color-*` custom properties plus visor LED tokens. */
export function schemeToVars(seedHex: string, isDark: boolean): Record<string, string> {
  const scheme = buildScheme(seedHex, isDark);
  const vars: Record<string, string> = {};
  for (const color of colors.allColors) {
    if (!color) continue;
    if (color.name.endsWith('palette_key_color')) continue;
    vars[`--md-sys-color-${color.name.replace(/_/g, '-')}`] = hexFromArgb(color.getArgb(scheme));
  }
  // Roles some library versions leave out of allColors.
  vars['--md-sys-color-surface-variant'] ??= vars['--md-sys-color-surface-container-highest'];
  vars['--md-sys-color-surface-tint'] ??= vars['--md-sys-color-primary'];
  vars['--md-sys-color-shadow'] ??= '#000000';
  vars['--md-sys-color-scrim'] ??= '#000000';
  // The visor is always a dark glass panel, tinted with the primary hue.
  const p = scheme.primaryPalette;
  const t = scheme.tertiaryPalette;
  const glass = TonalPalette.fromHueAndChroma(p.hue, 16);
  vars['--visor-bg'] = hexFromArgb(glass.tone(isDark ? 5 : 8));
  vars['--visor-bg-edge'] = hexFromArgb(glass.tone(isDark ? 16 : 20));
  vars['--visor-off'] = hexFromArgb(TonalPalette.fromHueAndChroma(p.hue, 30).tone(isDark ? 14 : 17));
  vars['--visor-led'] = hexFromArgb(p.tone(80));
  vars['--visor-led-core'] = hexFromArgb(p.tone(95));
  vars['--visor-blush'] = hexFromArgb(t.tone(76));
  return vars;
}

export function seedTriad(seedHex: string): [string, string, string] {
  const s = buildScheme(seedHex, false);
  return [
    hexFromArgb(s.primaryPalette.tone(50)),
    hexFromArgb(s.secondaryPalette.tone(70)),
    hexFromArgb(s.tertiaryPalette.tone(75)),
  ];
}
