"use client";

import {
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
} from "react";
import { useM3Theme } from "./M3ThemeProvider";
import {
  m3Curves,
  m3Duration,
  m3Rounding,
} from "./tokens";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Visual scale — StyledSwitch.qml default 0.75 */
  scale?: number;
};

/**
 * M3 switch with stretching thumb — port of `StyledSwitch.qml`
 */
export function M3Switch({
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange,
  scale = 0.75,
  disabled,
  style,
  ...rest
}: Props) {
  const { palette } = useM3Theme();
  const [uncontrolled, setUncontrolled] = useState(defaultChecked);
  const [pressed, setPressed] = useState(false);
  const controlled = checkedProp !== undefined;
  const checked = controlled ? checkedProp : uncontrolled;

  const trackW = 52 * scale;
  const trackH = 30 * scale;
  const thumbSize = 26 * scale;
  const pad = 2 * scale;
  const stretchExtra = 4 * scale;

  const thumbW = pressed ? thumbSize + stretchExtra : thumbSize;
  const left = checked
    ? pressed
      ? trackW - thumbW - pad - stretchExtra
      : trackW - thumbW - pad
    : pad;

  const toggle = () => {
    if (disabled) return;
    const next = !checked;
    if (!controlled) setUncontrolled(next);
    onCheckedChange?.(next);
  };

  const trackStyle: CSSProperties = {
    position: "relative",
    width: trackW,
    height: trackH,
    borderRadius: m3Rounding.full,
    border: "1px solid rgba(255,255,255,0.06)",
    backgroundColor: checked
      ? palette.colPrimaryContainer
      : palette.surfaceBright,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    transition: `background-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
    appearance: "none",
    padding: 0,
    flexShrink: 0,
    ...style,
  };

  const thumbStyle: CSSProperties = {
    position: "absolute",
    top: "50%",
    left,
    width: thumbW,
    height: thumbSize,
    marginTop: -thumbSize / 2,
    borderRadius: m3Rounding.full,
    backgroundColor: palette.colPrimary,
    boxShadow: "0 2px 4px rgba(0,0,0,0.35)",
    transition: [
      `left ${m3Duration.switchMove}ms ${m3Curves.switchThumb}`,
      `width ${m3Duration.switchStretch}ms ${m3Curves.switchThumb}`,
    ].join(", "),
    pointerEvents: "none",
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      style={trackStyle}
      onClick={toggle}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      {...rest}
    >
      <span style={thumbStyle} />
    </button>
  );
}
