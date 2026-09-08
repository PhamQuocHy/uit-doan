"use client";

import {
  forwardRef,
  useState,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useM3Theme } from "./M3ThemeProvider";
import { m3Curves, m3Duration, m3Rounding, withAlpha } from "./tokens";
import { useRipple, RippleStyles, withRippleHostStyle } from "./useRipple";

export type M3CardVariant = "elevated" | "filled" | "outlined";

export type M3CardProps = Omit<HTMLAttributes<HTMLElement>, "color"> & {
  /** Variant per M3 spec: elevated | filled | outlined */
  variant?: M3CardVariant;
  /** Enables interactive hover lift, cursor pointer, ripple, and state layer */
  interactive?: boolean;
  /** Whether to lift the card vertically on hover */
  hoverLift?: boolean;
  /** Corner radius token or custom pixel value (default: large = 20px) */
  rounding?: "small" | "normal" | "large" | "verylarge" | "full" | number;
  /** Custom root HTML tag or Next.js Link */
  component?: ElementType;
  /** If provided, renders as an accessible Next.js Link */
  href?: string;
  /** Disabled state */
  disabled?: boolean;
  children?: ReactNode;
};

/**
 * Material 3 Expressive Card — Official port of https://m3.material.io/components/cards
 * Supports elevated, filled, and outlined variants with expressive hover lift & ripple.
 */
export const M3Card = forwardRef<HTMLElement, M3CardProps>(function M3Card(
  {
    variant = "elevated",
    interactive = false,
    hoverLift = true,
    rounding = "large",
    component,
    href,
    disabled = false,
    onClick,
    onMouseEnter,
    onMouseLeave,
    style,
    className,
    children,
    ...rest
  },
  ref,
) {
  const { palette } = useM3Theme();
  const [hovered, setHovered] = useState(false);

  const isInteractive = interactive || Boolean(href) || Boolean(onClick);

  const { onPointerDown, rippleLayer } = useRipple({
    color: withAlpha(palette.colPrimary, 0.12),
    disabled: disabled || !isInteractive,
  });

  // Calculate border radius
  const radius =
    typeof rounding === "number"
      ? `${rounding}px`
      : rounding === "small"
        ? `${m3Rounding.small}px`
        : rounding === "normal"
          ? `${m3Rounding.normal}px`
          : rounding === "large"
            ? `${m3Rounding.large}px`
            : rounding === "verylarge"
              ? `${m3Rounding.verylarge}px`
              : `${m3Rounding.full}px`;

  // Base styles per variant
  let bg = "#ffffff";
  let border = "1px solid transparent";
  let shadow = "none";

  if (variant === "elevated") {
    bg = "#ffffff";
    border = "1px solid rgba(0, 0, 0, 0.06)";
    shadow = "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)";

    if (hovered && isInteractive && !disabled) {
      border = `1px solid ${withAlpha(palette.colPrimary, 0.35)}`;
      shadow = `0 12px 28px -4px ${withAlpha(palette.colPrimary, 0.15)}, 0 4px 12px rgba(0, 0, 0, 0.04)`;
    }
  } else if (variant === "filled") {
    bg = hovered && isInteractive && !disabled
      ? "#e8f0fe"
      : "#f4f7fb";
    border = "none";
    shadow = hovered && isInteractive && !disabled
      ? `0 10px 24px -4px ${withAlpha(palette.colPrimary, 0.14)}, 0 4px 10px rgba(0, 0, 0, 0.03)`
      : "none";
  } else if (variant === "outlined") {
    bg = "#ffffff";
    border = `1px solid ${
      hovered && isInteractive && !disabled
        ? palette.colPrimary
        : palette.colOutlineVariant || "rgba(0, 0, 0, 0.08)"
    }`;
    shadow = hovered && isInteractive && !disabled
      ? `0 6px 18px ${withAlpha(palette.colPrimary, 0.1)}`
      : "none";
  }

  const transform =
    hovered && isInteractive && hoverLift && !disabled
      ? "translateY(-3px)"
      : "translateY(0)";

  const cardStyle: CSSProperties = withRippleHostStyle({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    borderRadius: radius,
    backgroundColor: bg,
    border,
    boxShadow: shadow,
    transform,
    transition: [
      `transform ${m3Duration.expressiveDefaultSpatial}ms ${m3Curves.expressiveDefaultSpatial}`,
      `box-shadow ${m3Duration.expressiveDefaultSpatial}ms ${m3Curves.expressiveDefaultSpatial}`,
      `border-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
      `background-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
    ].join(", "),
    cursor: isInteractive && !disabled ? "pointer" : undefined,
    textDecoration: "none",
    color: "inherit",
    boxSizing: "border-box",
    overflow: "hidden",
    opacity: disabled ? 0.6 : 1,
    pointerEvents: disabled ? "none" : undefined,
    ...style,
  });

  const handleMouseEnter = (e: MouseEvent<HTMLElement>) => {
    if (!disabled && isInteractive) setHovered(true);
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: MouseEvent<HTMLElement>) => {
    if (!disabled && isInteractive) setHovered(false);
    onMouseLeave?.(e);
  };

  const handleMouseDown = (e: MouseEvent<HTMLElement>) => {
    if (!disabled && isInteractive) onPointerDown(e);
  };

  // Determine element to render
  const Component = href ? Link : (component || (isInteractive ? "div" : "div"));

  return (
    <Component
      ref={ref as any}
      href={href as any}
      className={`m3-card m3-card-${variant} ${className || ""}`}
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      {...rest}
    >
      {children}
      {isInteractive && !disabled && rippleLayer}
    </Component>
  );
});
