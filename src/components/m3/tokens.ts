/**
 * Material 3 tokens ported from end4-pC `modules/common/Appearance.qml`
 * https://github.com/pctrade/end4-pC
 */

export type M3ColorScheme = {
  darkmode: boolean;
  background: string;
  onBackground: string;
  surface: string;
  surfaceDim: string;
  surfaceBright: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  inverseSurface: string;
  inverseOnSurface: string;
  outline: string;
  outlineVariant: string;
  shadow: string;
  scrim: string;
  surfaceTint: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  inversePrimary: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  success: string;
  onSuccess: string;
  successContainer: string;
  onSuccessContainer: string;
};

/** Exact dark defaults from Appearance.qml m3colors */
export const m3Dark: M3ColorScheme = {
  darkmode: true,
  background: "#141313",
  onBackground: "#e6e1e1",
  surface: "#141313",
  surfaceDim: "#141313",
  surfaceBright: "#3a3939",
  surfaceContainerLowest: "#0f0e0e",
  surfaceContainerLow: "#1c1b1c",
  surfaceContainer: "#201f20",
  surfaceContainerHigh: "#2b2a2a",
  surfaceContainerHighest: "#363435",
  onSurface: "#e6e1e1",
  surfaceVariant: "#49464a",
  onSurfaceVariant: "#cbc5ca",
  inverseSurface: "#e6e1e1",
  inverseOnSurface: "#313030",
  outline: "#948f94",
  outlineVariant: "#49464a",
  shadow: "#000000",
  scrim: "#000000",
  surfaceTint: "#cbc4cb",
  primary: "#cbc4cb",
  onPrimary: "#322f34",
  primaryContainer: "#2d2a2f",
  onPrimaryContainer: "#bcb6bc",
  inversePrimary: "#615d63",
  secondary: "#cac5c8",
  onSecondary: "#323032",
  secondaryContainer: "#4d4b4d",
  onSecondaryContainer: "#ece6e9",
  tertiary: "#d1c3c6",
  onTertiary: "#372e30",
  tertiaryContainer: "#31292b",
  onTertiaryContainer: "#c1b4b7",
  error: "#ffb4ab",
  onError: "#690005",
  errorContainer: "#93000a",
  onErrorContainer: "#ffdad6",
  success: "#B5CCBA",
  onSuccess: "#213528",
  successContainer: "#374B3E",
  onSuccessContainer: "#D1E9D6",
};

/** Light counterpart using the same M3 roles (inverseFixed / inversePrimary from dark) */
export const m3Light: M3ColorScheme = {
  darkmode: false,
  background: "#f7f9fb",
  onBackground: "#1b1d20",
  surface: "#f7f9fb",
  surfaceDim: "#dce3eb",
  surfaceBright: "#fbfcfe",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#f4f7fb",
  surfaceContainer: "#eef3f8",
  surfaceContainerHigh: "#eef1f4",
  surfaceContainerHighest: "#e4eaf2",
  onSurface: "#1b1d20",
  surfaceVariant: "#e3e8ee",
  onSurfaceVariant: "#475569",
  inverseSurface: "#2f3337",
  inverseOnSurface: "#e9edf2",
  outline: "#5f6368",
  outlineVariant: "#e3e8ee",
  shadow: "#000000",
  scrim: "#000000",
  surfaceTint: "#4a5560",
  primary: "#4a5560",
  onPrimary: "#ffffff",
  primaryContainer: "#dfe8f2",
  onPrimaryContainer: "#16232f",
  inversePrimary: "#c5d3e2",
  secondary: "#55606b",
  onSecondary: "#ffffff",
  secondaryContainer: "#e3e9f1",
  onSecondaryContainer: "#131a22",
  tertiary: "#5a5f6e",
  onTertiary: "#ffffff",
  tertiaryContainer: "#e4e8f2",
  onTertiaryContainer: "#171c28",
  error: "#ba1a1a",
  onError: "#ffffff",
  errorContainer: "#ffdad6",
  onErrorContainer: "#410002",
  success: "#386a4a",
  onSuccess: "#ffffff",
  successContainer: "#b5ccba",
  onSuccessContainer: "#002110",
};

/** Appearance.rounding */
export const m3Rounding = {
  unsharpen: 2,
  unsharpenmore: 6,
  verysmall: 8,
  small: 12,
  normal: 17,
  large: 23,
  verylarge: 30,
  full: 9999,
  windowRounding: 18,
} as const;

/** Appearance.font.pixelSize */
export const m3FontSize = {
  smallest: 10,
  smaller: 12,
  smallie: 13,
  small: 16,
  normal: 16,
  large: 17,
  larger: 19,
  huge: 22,
  hugeass: 23,
  title: 22,
} as const;

/** Appearance.animationCurves — CSS cubic-bezier takes first 4 control points */
export const m3Curves = {
  expressiveFastSpatial: "cubic-bezier(0.42, 1.67, 0.21, 0.90)",
  expressiveDefaultSpatial: "cubic-bezier(0.38, 1.21, 0.22, 1.00)",
  expressiveSlowSpatial: "cubic-bezier(0.39, 1.29, 0.35, 0.98)",
  expressiveEffects: "cubic-bezier(0.34, 0.80, 0.34, 1.00)",
  emphasized: "cubic-bezier(0.2, 0, 0, 1)",
  emphasizedAccel: "cubic-bezier(0.3, 0, 0.8, 0.15)",
  emphasizedDecel: "cubic-bezier(0.05, 0.7, 0.1, 1)",
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  standardAccel: "cubic-bezier(0.3, 0, 1, 1)",
  standardDecel: "cubic-bezier(0, 0, 0, 1)",
  /** StyledSwitch thumb bounce */
  switchThumb: "cubic-bezier(0.42, 1.5, 0.28, 0.95)",
} as const;

export const m3Duration = {
  expressiveFastSpatial: 350,
  expressiveDefaultSpatial: 500,
  expressiveSlowSpatial: 650,
  expressiveEffects: 200,
  elementMoveEnter: 400,
  elementMoveExit: 200,
  elementResize: 300,
  clickBounce: 400,
  switchMove: 320,
  switchStretch: 160,
  ripple: 1200,
} as const;

/** Mix two hex colors (Appearance ColorUtils.mix approximation, amount = weight of `a`) */
export function mixColor(a: string, b: string, amount = 0.5): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return a;
  const t = 1 - amount;
  const r = Math.round(pa.r * amount + pb.r * t);
  const g = Math.round(pa.g * amount + pb.g * t);
  const bl = Math.round(pa.b * amount + pb.b * t);
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const p = parseHex(hex);
  if (!p) return hex;
  return `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha})`;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "").trim();
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function toHex(n: number) {
  return Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
}

/** Derived interaction colors (Appearance.colors.*) */
export function derivePalette(scheme: M3ColorScheme) {
  const layer1 = scheme.surfaceContainerLow;
  const onLayer1 = scheme.onSurfaceVariant;
  const layer1Hover = mixColor(layer1, onLayer1, 0.92);
  const layer1Active = mixColor(layer1, onLayer1, 0.85);

  return {
    ...scheme,
    colSubtext: scheme.outline,
    colLayer0: scheme.background,
    colOnLayer0: scheme.onBackground,
    colLayer1: layer1,
    colOnLayer1: onLayer1,
    colLayer1Hover: layer1Hover,
    colLayer1Active: layer1Active,
    colLayer2: scheme.surfaceContainer,
    colOnLayer2: scheme.onSurface,
    colPrimary: scheme.primary,
    colOnPrimary: scheme.onPrimary,
    colPrimaryHover: mixColor(scheme.primary, layer1Hover, 0.87),
    colPrimaryActive: mixColor(scheme.primary, layer1Active, 0.7),
    colPrimaryContainer: scheme.primaryContainer,
    colPrimaryContainerHover: mixColor(
      scheme.primaryContainer,
      scheme.onPrimaryContainer,
      0.9,
    ),
    colPrimaryContainerActive: mixColor(
      scheme.primaryContainer,
      scheme.onPrimaryContainer,
      0.8,
    ),
    colOnPrimaryContainer: scheme.onPrimaryContainer,
    colSecondary: scheme.secondary,
    colOnSecondary: scheme.onSecondary,
    colSecondaryContainer: scheme.secondaryContainer,
    colSecondaryContainerHover: mixColor(
      scheme.secondaryContainer,
      scheme.onSecondaryContainer,
      0.9,
    ),
    colSecondaryContainerActive: mixColor(
      scheme.secondaryContainer,
      scheme.onSecondaryContainer,
      0.54,
    ),
    colOnSecondaryContainer: scheme.onSecondaryContainer,
    colOutline: scheme.outline,
    colOutlineVariant: scheme.outlineVariant,
    colError: scheme.error,
    colOnError: scheme.onError,
    colErrorContainer: scheme.errorContainer,
    colOnErrorContainer: scheme.onErrorContainer,
    colOnSurface: scheme.onSurface,
    colOnSurfaceVariant: scheme.onSurfaceVariant,
    colSurfaceContainerHigh: scheme.surfaceContainerHigh,
    colScrim: withAlpha(scheme.scrim, 0.5),
    colShadow: withAlpha(scheme.shadow, 0.3),
  };
}

export type M3Palette = ReturnType<typeof derivePalette>;

/** Remap primary roles to a brand accent (e.g. portal blue #1a73e8). */
export function withPrimaryAccent(palette: M3Palette, primary: string): M3Palette {
  const onPrimary = "#ffffff";
  const primaryContainer = mixColor(primary, "#ffffff", 0.16);
  const onPrimaryContainer = mixColor(primary, "#0a1628", 0.55);
  const layer1Hover = palette.colLayer1Hover;
  const layer1Active = palette.colLayer1Active;

  return {
    ...palette,
    primary,
    onPrimary,
    primaryContainer,
    onPrimaryContainer,
    inversePrimary: mixColor(primary, "#ffffff", 0.65),
    surfaceTint: primary,
    colPrimary: primary,
    colOnPrimary: onPrimary,
    colPrimaryHover: mixColor(primary, layer1Hover, 0.87),
    colPrimaryActive: mixColor(primary, layer1Active, 0.7),
    colPrimaryContainer: primaryContainer,
    colPrimaryContainerHover: mixColor(primaryContainer, onPrimaryContainer, 0.9),
    colPrimaryContainerActive: mixColor(primaryContainer, onPrimaryContainer, 0.8),
    colOnPrimaryContainer: onPrimaryContainer,
  };
}
