"use client";

import { clsx } from "clsx";

interface BadgeProps {
  label: string;
  variant?: "success" | "danger" | "warning" | "info" | "default";
  size?: "sm" | "md";
  dot?: boolean;
}

export default function Badge({
  label,
  variant = "default",
  size = "sm",
  dot = false,
}: BadgeProps) {
  const styles = {
    success: {
      background: "rgba(52,199,89,0.12)",
      color: "#248a3d",
      dot: "#34c759",
    },
    danger: {
      background: "rgba(255,59,48,0.1)",
      color: "#ff3b30",
      dot: "#ff3b30",
    },
    warning: {
      background: "rgba(255,149,0,0.12)",
      color: "#c93400",
      dot: "#ff9500",
    },
    info: {
      background: "rgba(0,122,255,0.1)",
      color: "#007aff",
      dot: "#007aff",
    },
    default: {
      background: "#f5f5f7",
      color: "#636366",
      dot: "#8e8e93",
    },
  };
  const s = styles[variant];
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-[8px] font-semibold tracking-wide",
        sizeClass,
      )}
      style={{ background: s.background, color: s.color }}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: s.dot }}
        />
      )}
      {label}
    </span>
  );
}
