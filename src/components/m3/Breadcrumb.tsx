"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { MouseEvent } from "react";
import { useM3Theme } from "./M3ThemeProvider";
import { m3Rounding } from "./tokens";

export type M3BreadcrumbItem = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type Props = {
  items: M3BreadcrumbItem[];
  /** Last item is the current page (not a link). */
};

const VISIT_PREFIX = /^Lượt khám\s+/i;

function CrumbText({ label }: { label: string }) {
  const compact = label.replace(VISIT_PREFIX, "").trim();
  const hasPrefix = compact !== label.trim() && compact.length > 0;
  if (!hasPrefix) return <>{label}</>;
  return (
    <>
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{compact}</span>
    </>
  );
}

/**
 * Material 3 Breadcrumb — compact trail, chevron separator.
 * Spec: https://m3.material.io/components
 */
export function M3Breadcrumb({ items }: Props) {
  const { palette } = useM3Theme();
  const current = items[items.length - 1];
  const ancestors = items.slice(0, -1);

  return (
    <nav aria-label="Đường dẫn" className="min-w-0 max-w-full leading-none">
      <ol className="flex flex-nowrap items-center gap-1 overflow-hidden">
        {ancestors.map((item) => {
          const clickable = Boolean(item.onClick || item.href);
          return (
            <li
              key={item.label}
              className="inline-flex min-w-0 items-center gap-1"
            >
              {clickable ? (
                <Link
                  href={item.href || "#"}
                  onClick={(e: MouseEvent<HTMLAnchorElement>) => {
                    if (item.onClick) {
                      e.preventDefault();
                      item.onClick();
                    }
                  }}
                  className="max-w-[42vw] truncate rounded-[8px] px-1 text-[13px] font-medium sm:max-w-none sm:text-[16px]"
                  style={{
                    color: palette.primary,
                    transition: "background-color 200ms cubic-bezier(0.34,0.8,0.34,1)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      palette.primaryContainer)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <CrumbText label={item.label} />
                </Link>
              ) : (
                <span
                  className="truncate text-[13px] font-medium sm:text-[16px]"
                  style={{ color: palette.onSurfaceVariant }}
                >
                  <CrumbText label={item.label} />
                </span>
              )}
              <ChevronRight
                size={16}
                className="shrink-0 sm:size-[18px]"
                style={{ color: palette.onSurfaceVariant }}
                aria-hidden
              />
            </li>
          );
        })}
        {current ? (
          <li
            aria-current="page"
            className="min-w-0 truncate text-[13px] font-medium sm:text-[16px]"
            style={{ color: palette.onSurface, borderRadius: m3Rounding.verysmall }}
          >
            <CrumbText label={current.label} />
          </li>
        ) : null}
      </ol>
    </nav>
  );
}
