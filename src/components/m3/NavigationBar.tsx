"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { M3Fab } from "./Fab";
import { useM3Theme } from "./M3ThemeProvider";
import { RippleStyles, useRipple, withRippleHostStyle } from "./useRipple";
import {
  m3Curves,
  m3Duration,
  m3Rounding,
  withAlpha,
} from "./tokens";

export type M3NavItem<T extends string = string> = {
  id: T;
  label: string;
  icon: ReactNode;
};

export type M3NavAction = {
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
};

type Props<T extends string> = {
  items: readonly M3NavItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Squircle bên phải — Meet-style (vd. Hỗ trợ). */
  trailing?: M3NavAction;
  className?: string;
};

const SLOT = 48;
const BLOB = 40;
const GAP = 4;
const PAD_X = 14;
const PAD_Y = 8;
const INSET = (SLOT - BLOB) / 2;
const BAR_H = PAD_Y * 2 + SLOT;
const SHADOW =
  "0 1px 2px rgba(60,64,67,0.10), 0 4px 14px rgba(60,64,67,0.12)";

/**
 * Floating M3 Expressive toolbar — Google Meet-style:
 * light stadium + optional blue squircle action.
 */
export function M3NavigationBar<T extends string>({
  items,
  value,
  onChange,
  trailing,
  className,
}: Props<T>) {
  const { palette } = useM3Theme();
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorLeft, setIndicatorLeft] = useState(INSET);
  const [pressed, setPressed] = useState(false);
  const currentIndex = items.findIndex((item) => item.id === value);
  const showIndicator = currentIndex >= 0;

  useLayoutEffect(() => {
    if (!showIndicator) return;
    const el = itemRefs.current[currentIndex];
    if (!el) return;
    setIndicatorLeft(el.offsetLeft + INSET);
  }, [currentIndex, items.length, showIndicator]);

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
      }}
    >
        <nav
          aria-label="Điều hướng chính"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: BAR_H,
            padding: `${PAD_Y}px ${PAD_X}px`,
            borderRadius: m3Rounding.full,
            backgroundColor: "#f4f4f6",
            boxShadow: SHADOW,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: GAP,
            }}
          >
            {showIndicator ? (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: INSET,
                  left: indicatorLeft,
                  width: BLOB,
                  height: BLOB,
                  borderRadius: pressed ? m3Rounding.small : BLOB / 2,
                  backgroundColor: palette.colPrimaryContainer,
                  pointerEvents: "none",
                  transition: [
                    `left ${m3Duration.expressiveDefaultSpatial}ms ${m3Curves.expressiveDefaultSpatial}`,
                    `border-radius ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
                  ].join(", "),
                }}
              />
            ) : null}
            {items.map((item, index) => (
              <NavItemButton
                key={item.id}
                active={item.id === value}
                label={item.label}
                icon={item.icon}
                onClick={() => onChange(item.id)}
                onPressedChange={setPressed}
                buttonRef={(el) => {
                  itemRefs.current[index] = el;
                }}
              />
            ))}
          </div>
        </nav>

        {trailing ? (
          <M3Fab
            shape="fab"
            expressive
            baseSize={BAR_H}
            color={trailing.active ? "primary" : "primaryContainer"}
            aria-label={trailing.label}
            aria-current={trailing.active ? "page" : undefined}
            icon={trailing.icon}
            onClick={trailing.onClick}
            style={{ boxShadow: SHADOW }}
          />
        ) : null}
      </div>
  );
}

function NavItemButton({
  active,
  label,
  icon,
  onClick,
  onPressedChange,
  buttonRef,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  onPressedChange: (pressed: boolean) => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}) {
  const { palette } = useM3Theme();
  const [pressed, setPressed] = useState(false);
  const { onPointerDown, rippleLayer } = useRipple({
    color: withAlpha(palette.colOnSurface, 0.14),
  });

  const setPress = (next: boolean) => {
    setPressed(next);
    if (active) onPressedChange(next);
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      onMouseDown={(e) => {
        setPress(true);
        onPointerDown(e);
      }}
      onMouseUp={() => setPress(false)}
      onMouseLeave={() => setPress(false)}
      style={withRippleHostStyle({
        appearance: "none",
        border: 0,
        outline: "none",
        margin: 0,
        padding: 0,
        boxSizing: "border-box",
        width: SLOT,
        height: SLOT,
        minWidth: SLOT,
        minHeight: SLOT,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: palette.onSurfaceVariant,
        background: "transparent",
        overflow: "visible",
        borderRadius: BLOB / 2,
        transform: pressed ? "scale(0.94)" : "scale(1)",
        transition: `transform ${m3Duration.clickBounce}ms ${m3Curves.expressiveDefaultSpatial}`,
        flexShrink: 0,
      })}
    >
      {rippleLayer}
      <span
        style={{
          display: "inline-flex",
          width: 24,
          height: 24,
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        {icon}
      </span>
    </button>
  );
}
