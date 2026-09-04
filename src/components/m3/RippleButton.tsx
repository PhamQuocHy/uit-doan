"use client";

import {
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useM3Theme } from "./M3ThemeProvider";
import { RippleStyles, useRipple, withRippleHostStyle } from "./useRipple";
import {
  m3Curves,
  m3Duration,
  m3FontSize,
  m3Rounding,
  withAlpha,
} from "./tokens";

type Variant = "filled" | "tonal" | "outlined" | "text";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  toggled?: boolean;
  buttonRadius?: number;
  children?: ReactNode;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
};

/**
 * Ripple button — port of `RippleButton.qml`
 */
export function M3RippleButton({
  type = "button",
  variant = "tonal",
  toggled = false,
  buttonRadius = m3Rounding.small,
  children,
  startIcon,
  endIcon,
  disabled,
  style,
  onMouseDown,
  ...rest
}: Props) {
  const { palette } = useM3Theme();
  const [hovered, setHovered] = useState(false);

  const colors = resolveColors(variant, toggled, hovered, palette);

  const { onPointerDown, rippleLayer } = useRipple({
    color: colors.ripple,
    disabled: !!disabled,
  });

  const sx: CSSProperties = withRippleHostStyle({
    appearance: "none",
    border:
      variant === "outlined"
        ? `1px solid ${palette.colOutlineVariant}`
        : "0",
    margin: 0,
    font: "inherit",
    cursor: disabled ? "default" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 16px",
    minHeight: 40,
    borderRadius: buttonRadius,
    backgroundColor: colors.bg,
    color: colors.fg,
    fontSize: m3FontSize.small,
    fontWeight: 500,
    opacity: disabled ? 0.4 : 1,
    transition: `background-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}, color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
    ...style,
  });

  return (
    <button
      type={type}
      disabled={disabled}
      aria-pressed={toggled || undefined}
      style={sx}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(e) => {
        onPointerDown(e);
        onMouseDown?.(e);
      }}
      {...rest}
    >
      {rippleLayer}
      {startIcon}
      {children}
      {endIcon}
    </button>
  );
}

function resolveColors(
  variant: Variant,
  toggled: boolean,
  hovered: boolean,
  p: ReturnType<typeof useM3Theme>["palette"],
) {
  if (toggled || variant === "filled") {
    return {
      bg: hovered ? p.colPrimaryHover : p.colPrimary,
      fg: p.colOnPrimary,
      ripple: p.colPrimaryActive,
    };
  }
  if (variant === "tonal") {
    return {
      bg: hovered ? p.colPrimaryContainerHover : p.colPrimaryContainer,
      fg: p.colOnPrimaryContainer,
      ripple: p.colPrimaryContainerActive,
    };
  }
  if (variant === "outlined") {
    return {
      bg: hovered ? withAlpha(p.colOnSurface, 0.08) : "transparent",
      fg: p.colPrimary,
      ripple: withAlpha(p.colOnSurface, 0.12),
    };
  }
  return {
    bg: hovered ? withAlpha(p.colOnSurface, 0.08) : "transparent",
    fg: p.colPrimary,
    ripple: withAlpha(p.colOnSurface, 0.12),
  };
}
