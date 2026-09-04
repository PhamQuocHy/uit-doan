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
} from "./tokens";

type FabColor = "primary" | "primaryContainer" | "secondaryContainer" | "tertiaryContainer";
type FabShape = "fab" | "round";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  /** Extended FAB label — FloatingActionButton.qml `expanded` */
  expanded?: boolean;
  label?: string;
  baseSize?: number;
  /**
   * M3 Expressive motion (bounce + radius morph on press).
   */
  expressive?: boolean;
  /**
   * `fab` = squircle (size/14*4); `round` = circle — sync with pill inputs.
   */
  shape?: FabShape;
  color?: FabColor;
};

/**
 * Material FAB — port of `FloatingActionButton.qml`
 * + M3 Expressive shape morph / bounce on press.
 */
export function M3Fab({
  icon,
  expanded = false,
  label,
  baseSize = 56,
  expressive = true,
  shape = "fab",
  color = "primaryContainer",
  children,
  disabled,
  style,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  type = "button",
  ...rest
}: Props) {
  const { palette } = useM3Theme();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const circle = baseSize / 2;
  const squircle = (baseSize / 14) * 4; // ≈16 at 56

  // round shape syncs with pill inputs; fab keeps classic M3 squircle
  let idleRadius = shape === "round" ? circle : squircle;
  let pressedRadius = shape === "round" ? squircle : circle; // morph toward the other
  if (!expressive) {
    pressedRadius = idleRadius;
  }
  const radius = pressed ? pressedRadius : idleRadius;

  const showLabel = expanded && (label || typeof children === "string");
  const colors = resolveFabColors(color, hovered, pressed, palette);

  const { onPointerDown, rippleLayer } = useRipple({
    color: colors.ripple,
    disabled: !!disabled,
  });

  // GroupButton-style bounce: grow slightly while pressed
  const bounceScale = expressive && pressed ? 1.06 : 1;

  const sx: CSSProperties = withRippleHostStyle({
    appearance: "none",
    border: 0,
    margin: 0,
    font: "inherit",
    cursor: disabled ? "default" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: showLabel ? "flex-start" : "center",
    gap: 5,
    height: baseSize,
    width: showLabel ? undefined : baseSize,
    minWidth: baseSize,
    paddingLeft: showLabel ? (baseSize - 26) / 2 : 0,
    paddingRight: showLabel ? 16 : 0,
    borderRadius: radius,
    backgroundColor: colors.bg,
    color: colors.fg,
    fontSize: 14,
    fontWeight: 500,
    boxShadow:
      shape === "round"
        ? hovered || pressed
          ? "0 2px 6px rgba(26,115,232,0.28)"
          : "0 1px 2px rgba(26,115,232,0.18)"
        : hovered || pressed
          ? "0 3px 8px rgba(26,115,232,0.32)"
          : "0 1px 3px rgba(26,115,232,0.22)",
    opacity: disabled ? 0.4 : 1,
    flexShrink: 0,
    transform: `scale(${bounceScale})`,
    transition: [
      `border-radius ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
      `transform ${m3Duration.clickBounce}ms ${m3Curves.expressiveDefaultSpatial}`,
      `background-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
      `box-shadow ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
      `min-width ${m3Duration.expressiveDefaultSpatial}ms ${m3Curves.expressiveDefaultSpatial}`,
      `padding ${m3Duration.expressiveDefaultSpatial}ms ${m3Curves.expressiveDefaultSpatial}`,
    ].join(", "),
    ...style,
  });

  return (
    <button
      type={type}
      disabled={disabled}
      style={sx}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={(e) => {
        setHovered(false);
        setPressed(false);
        onMouseLeave?.(e);
      }}
      onMouseDown={(e) => {
        setPressed(true);
        onPointerDown(e);
        onMouseDown?.(e);
      }}
      onMouseUp={(e) => {
        setPressed(false);
        onMouseUp?.(e);
      }}
      {...rest}
    >
      {rippleLayer}
      <span
        style={{
          display: "inline-flex",
          width: 26,
          height: 26,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: m3FontSize.huge,
        }}
      >
        {icon ?? children}
      </span>
      {showLabel ? (
        <span
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            paddingLeft: 5,
          }}
        >
          {label ?? (typeof children === "string" ? children : null)}
        </span>
      ) : null}
    </button>
  );
}

function resolveFabColors(
  color: FabColor,
  hovered: boolean,
  pressed: boolean,
  p: ReturnType<typeof useM3Theme>["palette"],
) {
  if (color === "primary") {
    return {
      bg: pressed
        ? p.colPrimaryActive
        : hovered
          ? p.colPrimaryHover
          : p.colPrimary,
      fg: p.colOnPrimary,
      ripple: p.colPrimaryActive,
    };
  }
  if (color === "secondaryContainer") {
    return {
      bg: pressed
        ? p.colSecondaryContainerActive
        : hovered
          ? p.colSecondaryContainerHover
          : p.colSecondaryContainer,
      fg: p.colOnSecondaryContainer,
      ripple: p.colSecondaryContainerActive,
    };
  }
  // primaryContainer (default) / tertiaryContainer fallback
  return {
    bg: pressed
      ? p.colPrimaryContainerActive
      : hovered
        ? p.colPrimaryContainerHover
        : p.colPrimaryContainer,
    fg: p.colOnPrimaryContainer,
    ripple: p.colPrimaryContainerActive,
  };
}
