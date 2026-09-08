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
    bg: "var(--m3-primary-container)",
    text: "var(--m3-on-primary-container)",
  },
  khaki: {
    bg: "var(--color-m3-warning-container, #ffdfb8)",
    text: "var(--color-m3-on-warning-container, #2c1700)",
  },
  forest: {
    bg: "var(--color-m3-success-container, #b5ccba)",
    text: "var(--color-m3-on-success-container, #002110)",
  },
  earth: {
    bg: "var(--m3-secondary-container)",
    text: "var(--m3-on-secondary-container)",
  },
  alert: {
    bg: "var(--m3-error-container)",
    text: "var(--m3-on-error-container)",
  },
};

/** M3 Expressive elevated card with tonal icon container */
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
      className="macos-card p-6 transition-transform duration-[400ms] ease-[cubic-bezier(0.38,1.21,0.22,1)] hover:-translate-y-1"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="rounded-full p-3.5"
          style={{ background: c.bg, color: c.text }}
        >
          {icon}
        </div>
        {trend && (
          <span
            className="rounded-full px-2.5 py-1 text-[13px] font-bold"
            style={{
              color: trendUp
                ? "var(--color-m3-on-success-container, #002110)"
                : "var(--m3-on-error-container)",
              background: trendUp
                ? "var(--color-m3-success-container, #b5ccba)"
                : "var(--m3-error-container)",
            }}
          >
            {trendUp ? "▲" : "▼"} {Math.abs(trend.value)}% {trend.label}
          </span>
        )}
      </div>
      <div className="mt-5">
        <p className="text-[36px] font-bold leading-none tracking-tight text-m3-on-surface">
          {value}
        </p>
        <p className="mt-2.5 text-[16px] font-semibold text-m3-on-surface">{title}</p>
        {subtitle && (
          <p className="mt-1 text-[14px] font-medium text-m3-on-surface-variant">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
