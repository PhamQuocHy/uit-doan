"use client";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: "olive" | "khaki" | "forest" | "earth" | "alert";
  subtitle?: string;
  trend?: { value: number; label: string };
}

const colorMap = {
  olive: {
    bg: "rgba(0,122,255,0.12)",
    text: "#007aff",
  },
  khaki: {
    bg: "rgba(255,149,0,0.14)",
    text: "#ff9500",
  },
  forest: {
    bg: "rgba(52,199,89,0.14)",
    text: "#34c759",
  },
  earth: {
    bg: "rgba(90,200,250,0.16)",
    text: "#5ac8fa",
  },
  alert: {
    bg: "rgba(255,59,48,0.12)",
    text: "#ff3b30",
  },
};

export default function StatCard({
  title,
  value,
  icon,
  color = "olive",
  subtitle,
  trend,
}: StatCardProps) {
  const c = colorMap[color];
  const trendUp = trend && trend.value >= 0;

  return (
    <div
      className="rounded-[22px] p-6 transition-transform duration-200 hover:-translate-y-0.5"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.03), 0 12px 32px rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="rounded-[16px] p-3.5"
          style={{ background: c.bg, color: c.text }}
        >
          {icon}
        </div>
        {trend && (
          <span
            className="rounded-[10px] px-2.5 py-1 text-[13px] font-bold"
            style={{
              color: trendUp ? "#248a3d" : "#ff3b30",
              background: trendUp
                ? "rgba(52,199,89,0.12)"
                : "rgba(255,59,48,0.1)",
            }}
          >
            {trendUp ? "▲" : "▼"} {Math.abs(trend.value)}% {trend.label}
          </span>
        )}
      </div>
      <div className="mt-5">
        <p className="text-[36px] font-bold leading-none tracking-tight text-[#1d1d1f]">
          {value}
        </p>
        <p className="mt-2.5 text-[16px] font-semibold text-[#1d1d1f]">{title}</p>
        {subtitle && (
          <p className="mt-1 text-[14px] font-medium text-[#6e6e73]">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
