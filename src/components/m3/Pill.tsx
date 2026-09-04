"use client";

import type { CSSProperties, ReactNode } from "react";
import { useM3Theme } from "./M3ThemeProvider";
import { m3Rounding } from "./tokens";

type Props = {
  children?: ReactNode;
  vertical?: boolean;
  crossAxisSize?: number;
  mainAxisPadding?: number;
  contentSpacing?: number;
  bgColor?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Simple material pill container — port of `MaterialPill.qml`
 */
export function M3Pill({
  children,
  vertical = false,
  crossAxisSize = 32,
  mainAxisPadding = 10,
  contentSpacing = 3,
  bgColor,
  className,
  style,
}: Props) {
  const { palette } = useM3Theme();

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        flexDirection: vertical ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: contentSpacing,
        width: vertical ? crossAxisSize : undefined,
        height: vertical ? undefined : crossAxisSize,
        padding: vertical
          ? `${mainAxisPadding}px 0`
          : `0 ${mainAxisPadding}px`,
        borderRadius: m3Rounding.full,
        backgroundColor: bgColor ?? palette.colPrimaryContainer,
        color: palette.colOnPrimaryContainer,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
