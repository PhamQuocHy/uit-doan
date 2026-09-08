"use client";

import type { CSSProperties, ReactNode } from "react";
import { useM3Theme } from "./M3ThemeProvider";
import { m3Rounding, withAlpha } from "./tokens";

type State = "hover" | "focus" | "press" | "drag";

const OPACITY: Record<State, number> = {
  hover: 0.08,
  focus: 0.1,
  press: 0.1,
  drag: 0.16,
};

/**
 * M3 state layer overlay — port of `StateLayer.qml`
 * https://m3.material.io/foundations/interaction/states/state-layers
 */
export function M3StateLayer({
  state = "hover",
  color,
  visible = true,
  borderRadius,
  style,
}: {
  state?: State;
  color?: string;
  visible?: boolean;
  borderRadius?: number | string;
  style?: CSSProperties;
}) {
  const { palette } = useM3Theme();
  if (!visible) return null;

  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: borderRadius ?? "inherit",
        backgroundColor: withAlpha(color ?? palette.colOnSurface, OPACITY[state]),
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

export function M3Surface({
  children,
  level = 1,
  className,
  style,
}: {
  children?: ReactNode;
  level?: 0 | 1 | 2 | 3 | 4;
  className?: string;
  style?: CSSProperties;
}) {
  const { palette } = useM3Theme();
  const bg =
    level === 0
      ? palette.colLayer0
      : level === 1
        ? palette.colLayer1
        : level === 2
          ? palette.colLayer2
          : level === 3
            ? palette.surfaceContainerHigh
            : palette.surfaceContainerHighest;

  return (
    <div
      className={className}
      style={{
        backgroundColor: bg,
        color: palette.colOnSurface,
        borderRadius: m3Rounding.normal,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
