"use client";

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { m3Curves, m3Duration } from "./tokens";

type RippleItem = {
  id: number;
  x: number;
  y: number;
  size: number;
};

type UseRippleOptions = {
  color?: string;
  duration?: number;
  disabled?: boolean;
};

export function useRipple(options: UseRippleOptions = {}) {
  const {
    color = "currentColor",
    duration = m3Duration.ripple,
    disabled = false,
  } = options;
  const [ripples, setRipples] = useState<RippleItem[]>([]);
  const seq = useRef(0);

  const onPointerDown = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (disabled) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dist = (ox: number, oy: number) => ox * ox + oy * oy;
      const radius = Math.sqrt(
        Math.max(
          dist(0, 0),
          dist(0, rect.height),
          dist(rect.width, 0),
          dist(rect.width, rect.height),
        ),
      );
      const id = ++seq.current;
      setRipples((prev) => [...prev, { id, x, y, size: radius * 2 }]);
      window.setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, duration * 2);
    },
    [disabled, duration],
  );

  const rippleLayer = (
    <span
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        borderRadius: "inherit",
        pointerEvents: "none",
      }}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          style={
            {
              position: "absolute",
              left: r.x,
              top: r.y,
              width: r.size,
              height: r.size,
              marginLeft: -r.size / 2,
              marginTop: -r.size / 2,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${color} 0%, ${color} 30%, transparent 50%)`,
              opacity: 0.35,
              animation: `m3-ripple-expand ${duration}ms ${m3Curves.standardDecel} forwards`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );

  return { onPointerDown, rippleLayer };
}

export function RippleStyles() {
  return null;
}

export function withRippleHostStyle(
  extra?: CSSProperties,
): CSSProperties {
  return {
    position: "relative",
    overflow: "hidden",
    WebkitTapHighlightColor: "transparent",
    ...extra,
  };
}

export type RippleRenderProps = {
  children?: ReactNode;
};
