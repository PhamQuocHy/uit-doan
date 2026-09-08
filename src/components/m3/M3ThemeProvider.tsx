"use client";

import {
  createContext,
  useContext,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  derivePalette,
  m3Dark,
  m3Light,
  withPrimaryAccent,
  type M3Palette,
} from "./tokens";

type Mode = "light" | "dark";

type M3ThemeContextValue = {
  mode: Mode;
  palette: M3Palette;
};

const M3ThemeContext = createContext<M3ThemeContextValue | null>(null);

function paletteToCssVars(p: M3Palette): CSSProperties {
  return {
    ["--m3-background" as string]: p.background,
    ["--m3-on-background" as string]: p.onBackground,
    ["--m3-surface" as string]: p.surface,
    ["--m3-surface-container-lowest" as string]: p.surfaceContainerLowest,
    ["--m3-surface-container-low" as string]: p.surfaceContainerLow,
    ["--m3-surface-container" as string]: p.surfaceContainer,
    ["--m3-surface-container-high" as string]: p.surfaceContainerHigh,
    ["--m3-surface-container-highest" as string]: p.surfaceContainerHighest,
    ["--m3-surface-bright" as string]: p.surfaceBright,
    ["--m3-on-surface" as string]: p.onSurface,
    ["--m3-on-surface-variant" as string]: p.onSurfaceVariant,
    ["--m3-outline" as string]: p.outline,
    ["--m3-outline-variant" as string]: p.outlineVariant,
    ["--m3-primary" as string]: p.primary,
    ["--m3-on-primary" as string]: p.onPrimary,
    ["--m3-primary-container" as string]: p.primaryContainer,
    ["--m3-on-primary-container" as string]: p.onPrimaryContainer,
    ["--m3-secondary" as string]: p.secondary,
    ["--m3-on-secondary" as string]: p.onSecondary,
    ["--m3-secondary-container" as string]: p.secondaryContainer,
    ["--m3-on-secondary-container" as string]: p.onSecondaryContainer,
    ["--m3-tertiary" as string]: p.tertiary,
    ["--m3-on-tertiary" as string]: p.onTertiary,
    ["--m3-error" as string]: p.error,
    ["--m3-on-error" as string]: p.onError,
    ["--m3-error-container" as string]: p.errorContainer,
    ["--m3-on-error-container" as string]: p.onErrorContainer,
    ["--m3-col-layer1" as string]: p.colLayer1,
    ["--m3-col-layer1-hover" as string]: p.colLayer1Hover,
    ["--m3-col-layer1-active" as string]: p.colLayer1Active,
    ["--m3-col-on-layer1" as string]: p.colOnLayer1,
    ["--m3-col-subtext" as string]: p.colSubtext,
    ["--m3-col-primary-hover" as string]: p.colPrimaryHover,
    ["--m3-col-primary-active" as string]: p.colPrimaryActive,
    ["--m3-col-secondary-container-hover" as string]: p.colSecondaryContainerHover,
    ["--m3-col-secondary-container-active" as string]:
      p.colSecondaryContainerActive,
    ["--m3-col-primary-container-hover" as string]: p.colPrimaryContainerHover,
    ["--m3-col-primary-container-active" as string]: p.colPrimaryContainerActive,
    ["--m3-scrim" as string]: p.colScrim,
    color: p.onSurface,
    backgroundColor: p.background,
  } as CSSProperties;
}

export function M3ThemeProvider({
  mode = "light",
  /** Brand primary override (e.g. "#1a73e8") */
  primary,
  children,
  className,
  style,
}: {
  mode?: Mode;
  primary?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const value = useMemo<M3ThemeContextValue>(() => {
    const scheme = mode === "dark" ? m3Dark : m3Light;
    let palette = derivePalette(scheme);
    if (primary) palette = withPrimaryAccent(palette, primary);
    return { mode, palette };
  }, [mode, primary]);

  return (
    <M3ThemeContext.Provider value={value}>
      <div
        className={className}
        data-m3-mode={mode}
        style={{
          ...paletteToCssVars(value.palette),
          backgroundColor: "transparent",
          ...style,
        }}
      >
        {children}
      </div>
    </M3ThemeContext.Provider>
  );
}

export function useM3Theme() {
  const ctx = useContext(M3ThemeContext);
  if (!ctx) {
    // Safe fallback so components still work without a provider
    return {
      mode: "light" as Mode,
      palette: derivePalette(m3Light),
    };
  }
  return ctx;
}
