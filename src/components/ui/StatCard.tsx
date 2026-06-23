"use client";

import { clsx } from "clsx";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: "olive" | "khaki" | "forest" | "earth" | "alert";
  subtitle?: string;
  trend?: { value: number; label: string };
}

export default function StatCard({
  title,
  value,
  icon,
  color = "olive",
  subtitle,
  trend,
}: StatCardProps) {
  const colorMap = {
    olive: {
      bg: "#f8fae8",
      text: "#748c2c",
      border: "#dce7ba",
    },
    khaki: {
      bg: "rgba(227,202,145,0.15)",
      text: "#a88a3e",
      border: "rgba(227,202,145,0.3)",
    },
    forest: {
      bg: "rgba(53,90,30,0.08)",
      text: "#465620",
      border: "rgba(53,90,30,0.15)",
    },
    earth: {
      bg: "rgba(116,140,44,0.1)",
      text: "#748c2c",
      border: "rgba(116,140,44,0.2)",
    },
    alert: {
      bg: "#fef2f2",
      text: "#dc2626",
      border: "#fecaca",
    },
  };
  const c = colorMap[color];
  const trendColor = trend && trend.value >= 0 ? "#748c2c" : "#dc2626";

  return (
    <div
      className="rounded-3xl p-6 hover:shadow-lg transition-shadow duration-200"
      style={{
        background: "#ffffff",
        border: "1px solid #edf4dc",
        boxShadow: "0 8px 30px rgba(0,0,0,0.02)",
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="p-3 rounded-xl shrink-0"
          style={{
            background: c.bg,
            color: c.text,
            border: `1px solid ${c.border}`,
          }}
        >
          {icon}
        </div>
        {trend && (
          <span
            className="text-xs font-semibold tracking-wide"
            style={{ color: trendColor }}
          >
            {trend.value >= 0 ? "▲" : "▼"} {Math.abs(trend.value)}%{" "}
            {trend.label}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold" style={{ color: "#3b491e" }}>
          {value}
        </p>
        <p
          className="text-xs font-bold mt-1 tracking-wide uppercase"
          style={{
            color: "#748c2c",
            letterSpacing: "0.05em",
          }}
        >
          {title}
        </p>
        {subtitle && (
          <p
            className="text-xs mt-1.5 font-medium"
            style={{ color: "#93a83e" }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
