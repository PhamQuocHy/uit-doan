"use client";

import { clsx } from "clsx";

interface BadgeProps {
  label: string;
  variant?: "success" | "danger" | "warning" | "info" | "default";
  size?: "sm" | "md";
  dot?: boolean;
}

/** M3 Expressive status chip — tonal container, pill radius */
export default function Badge({
  label,
  variant = "default",
  size = "sm",
  dot = false,
}: BadgeProps) {
  const styles = {
    success: {
      background: "var(--color-m3-success-container, #b5ccba)",
      color: "var(--color-m3-on-success-container, #002110)",
      dot: "var(--color-m3-success, #386a4a)",
    },
    danger: {
      background: "var(--m3-error-container)",
      color: "var(--m3-on-error-container)",
      dot: "var(--m3-error)",
    },
    warning: {
      background: "var(--color-m3-warning-container, #ffdfb8)",
      color: "var(--color-m3-on-warning-container, #2c1700)",
      dot: "var(--color-m3-warning, #8a5800)",
    },
    info: {
      background: "var(--m3-primary-container)",
      color: "var(--m3-on-primary-container)",
      dot: "var(--m3-primary)",
    },
    default: {
      background: "var(--m3-secondary-container)",
      color: "var(--m3-on-secondary-container)",
      dot: "var(--m3-outline)",
    },
  };
  const s = styles[variant];
  const sizeClass = size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide",
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
