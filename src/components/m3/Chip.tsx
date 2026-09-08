"use client";

import type { CSSProperties, ReactNode } from "react";
import { useM3Theme } from "./M3ThemeProvider";
import { m3Curves, m3Duration, m3Rounding, withAlpha } from "./tokens";

export type M3ChipVariant = "assist" | "filter" | "suggestion";

type Props = {
  children: ReactNode;
  /** assist = outlined + icon; filter = tonal filled; suggestion = outlined text */
  variant?: M3ChipVariant;
  icon?: ReactNode;
  /** Filter chip selected (filled primaryContainer) */
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
};

/**
 * Material 3 Chips — Assist / Filter / Suggestion
 * Spec: https://m3.material.io/components/chips/overview
 */
export function M3Chip({
  children,
  variant = "assist",
  icon,
  selected = false,
  onClick,
  className,
  style,
}: Props) {
  const { palette } = useM3Theme();

  const filled =
    variant === "filter"
      ? selected !== false // filter defaults to filled unless selected={false}
      : selected;

  const bg = filled ? palette.primaryContainer : "transparent";
  const fg = filled ? palette.onPrimaryContainer : palette.onSurface;
  const border = filled
    ? "1px solid transparent"
    : `1px solid ${withAlpha(palette.outline, 0.28)}`;

  const baseStyle: CSSProperties = {
    appearance: "none",
    margin: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 32,
    height: 32,
    padding: icon ? "0 12px 0 8px" : "0 12px",
    borderRadius: m3Rounding.verysmall, // 8 — M3 chip (không full pill)
    border,
    backgroundColor: bg,
    color: fg,
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "inherit",
    lineHeight: 1,
    cursor: onClick ? "pointer" : "default",
    maxWidth: "100%",
    boxSizing: "border-box",
    transition: [
      `background-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
      `border-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
      `transform ${m3Duration.clickBounce}ms ${m3Curves.expressiveDefaultSpatial}`,
    ].join(", "),
    ...style,
  };

  const content = (
    <>
      {icon ? (
        <span
          style={{
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            lineHeight: 0,
            color: filled ? palette.onPrimaryContainer : palette.primary,
          }}
        >
          {icon}
        </span>
      ) : null}
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        style={baseStyle}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = "scale(0.97)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={className} style={baseStyle}>
      {content}
    </span>
  );
}
