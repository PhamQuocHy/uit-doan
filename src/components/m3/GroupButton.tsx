"use client";

import {
  forwardRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useButtonGroup, useButtonGroupIndex } from "./ButtonGroup";
import { useM3Theme } from "./M3ThemeProvider";
import { m3Curves, m3Duration, m3FontSize, m3Rounding } from "./tokens";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  toggled?: boolean;
  bounce?: boolean;
  buttonText?: string;
  children?: ReactNode;
  /** Override corner radii (SelectionGroup sets these) */
  leftRadius?: number | string;
  rightRadius?: number | string;
  buttonRadius?: number;
  buttonRadiusPressed?: number;
  colBackground?: string;
  colBackgroundHover?: string;
  colBackgroundActive?: string;
  colBackgroundToggled?: string;
  colBackgroundToggledHover?: string;
  colBackgroundToggledActive?: string;
  horizontalPadding?: number;
  verticalPadding?: number;
};

/**
 * Material 3 expressive GroupButton — port of `GroupButton.qml`
 * Bounce + independent left/right radius for connected button groups.
 */
export const M3GroupButton = forwardRef<HTMLButtonElement, Props>(function M3GroupButton({
  toggled = false,
  bounce = true,
  buttonText,
  children,
  leftRadius,
  rightRadius,
  buttonRadius = m3Rounding.small,
  buttonRadiusPressed = m3Rounding.unsharpenmore,
  colBackground,
  colBackgroundHover,
  colBackgroundActive,
  colBackgroundToggled,
  colBackgroundToggledHover,
  colBackgroundToggledActive,
  horizontalPadding = 16,
  verticalPadding = 10,
  style,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  disabled,
  ...rest
}, ref) {
  const { palette } = useM3Theme();
  const group = useButtonGroup();
  const index = useButtonGroupIndex();
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isAtSide =
    index === 0 || (group ? index === group.count - 1 : false);

  const bg =
    colBackground ?? "transparent";
  const bgHover = colBackgroundHover ?? palette.colLayer1Hover;
  const bgActive = colBackgroundActive ?? palette.colLayer1Active;
  const bgToggled = colBackgroundToggled ?? palette.colPrimary;
  const bgToggledHover = colBackgroundToggledHover ?? palette.colPrimaryHover;
  const bgToggledActive =
    colBackgroundToggledActive ?? palette.colPrimaryActive;

  let color: string;
  if (disabled) {
    color = bg;
  } else if (toggled) {
    color = pressed ? bgToggledActive : hovered ? bgToggledHover : bgToggled;
  } else {
    color = pressed ? bgActive : hovered ? bgHover : bg;
  }

  const rL =
    leftRadius ?? (pressed ? buttonRadiusPressed : buttonRadius);
  const rR =
    rightRadius ?? (pressed ? buttonRadiusPressed : buttonRadius);

  const bouncePad = pressed && bounce ? (isAtSide ? 5 : 10) : 0;

  const sx: CSSProperties = {
    appearance: "none",
    border: 0,
    margin: 0,
    font: "inherit",
    cursor: disabled ? "default" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: `${verticalPadding}px ${horizontalPadding + bouncePad}px`,
    minHeight: 40,
    borderTopLeftRadius: typeof rL === "number" ? rL : rL,
    borderBottomLeftRadius: typeof rL === "number" ? rL : rL,
    borderTopRightRadius: typeof rR === "number" ? rR : rR,
    borderBottomRightRadius: typeof rR === "number" ? rR : rR,
    backgroundColor: color,
    color: toggled ? palette.colOnPrimary : palette.colOnLayer1,
    fontSize: m3FontSize.small,
    fontWeight: 500,
    lineHeight: 1.3,
    transition: [
      `background-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
      `border-radius ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
      `padding ${m3Duration.clickBounce}ms ${m3Curves.expressiveDefaultSpatial}`,
      `color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
    ].join(", "),
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    ...style,
  };

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={toggled}
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
        group?.setClickIndex(index);
        onMouseDown?.(e);
      }}
      onMouseUp={(e) => {
        setPressed(false);
        onMouseUp?.(e);
      }}
      {...rest}
    >
      {children ?? buttonText}
    </button>
  );
});
