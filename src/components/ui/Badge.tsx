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
      background: "#f8fae8",
      color: "#586c23",
      borderColor: "#c5d38c",
      dot: "#748c2c",
    },
    danger: {
      background: "#fef2f2",
      color: "#dc2626",
      borderColor: "#fecaca",
      dot: "#ef4444",
    },
    warning: {
      background: "rgba(227,202,145,0.15)",
      color: "#a88a3e",
      borderColor: "rgba(227,202,145,0.3)",
      dot: "#c4a862",
    },
    info: {
      background: "rgba(53,90,30,0.08)",
      color: "#465620",
      borderColor: "rgba(53,90,30,0.15)",
      dot: "#465620",
    },
    default: {
      background: "#ffffff",
      color: "#748c2c",
      borderColor: "#edf4dc",
      dot: "#93a83e",
    },
  };
  const s = styles[variant];

  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 font-semibold rounded-full ring-1 ring-inset uppercase tracking-wider",
        sizeClass,
      )}
      style={{
        background: s.background,
        color: s.color,
      }}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ background: s.dot }}
        />
      )}
      {label}
    </span>
  );
}
