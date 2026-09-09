"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { ReactNode } from "react";

export const ADMIN_SELECT_CLS =
  "h-9 min-w-0 rounded-full border border-black/[0.08] bg-white px-3.5 pr-8 text-[13px] font-medium text-m3-on-surface outline-none transition-colors hover:border-m3-primary/30 focus:border-m3-primary/40 focus:ring-2 focus:ring-m3-primary/10";

export const ADMIN_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export const ADMIN_TH_CLS =
  "bg-[#f1f5f9] px-4 py-3 text-left text-[12px] font-semibold text-m3-on-surface-variant";

export const ADMIN_TD_CLS = "px-4 py-3.5 text-[13px] text-m3-on-surface";

export function buildPageItems(
  current: number,
  total: number,
): Array<number | "ellipsis"> {
  if (total <= 1) return total === 1 ? [1] : [];
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, total]);

  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    if (current >= 3) pages.add(4);
  } else if (current >= total - 2) {
    pages.add(total - 1);
    pages.add(total - 2);
    if (current <= total - 2) pages.add(total - 3);
  } else {
    pages.add(current - 1);
    pages.add(current);
    pages.add(current + 1);
  }

  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const items: Array<number | "ellipsis"> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) {
      items.push("ellipsis");
    }
    items.push(sorted[i]!);
  }
  return items;
}

export function AdminListHeader({
  title,
  countLabel,
  filters,
  actions,
}: {
  title: string;
  countLabel?: string;
  filters?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <h1 className="text-[24px] font-bold tracking-tight text-m3-on-surface">
          {title}
        </h1>
        {filters}
        {countLabel ? (
          <span className="rounded-full bg-m3-primary/10 px-3 py-1 text-[12px] font-semibold text-m3-primary">
            {countLabel}
          </span>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function AdminStatusTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-black/[0.05] px-3 pt-2">
      {tabs.map((tab) => {
        const active = value === tab.value;
        return (
          <button
            key={tab.value || "all"}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`relative min-h-[42px] px-3.5 text-[13px] font-semibold transition-colors ${
              active
                ? "text-m3-primary"
                : "text-m3-on-surface-variant hover:text-m3-on-surface"
            }`}
          >
            {tab.label}
            {active ? (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-m3-primary" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function AdminListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Tìm kiếm...",
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = ADMIN_PAGE_SIZE_OPTIONS,
  extra,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: readonly number[];
  extra?: ReactNode;
}) {
  const pageItems = buildPageItems(page, totalPages);

  return (
    <div className="flex flex-col gap-3 border-b border-black/[0.05] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
          size={16}
        />
        <input
          type="text"
          placeholder={searchPlaceholder}
          className="h-9 w-full rounded-full border border-black/[0.08] bg-m3-surface-high/60 py-2 pl-9 pr-4 text-[13px] text-m3-on-surface outline-none placeholder:text-m3-on-surface-variant focus:border-m3-primary/35 focus:bg-white focus:ring-2 focus:ring-m3-primary/10"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {extra}
        <label className="inline-flex items-center gap-2 text-[13px] text-m3-on-surface-variant">
          Hiển thị
          <select
            className="h-9 rounded-lg border border-black/[0.08] bg-white px-2 text-[13px] font-semibold text-m3-on-surface outline-none"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          dòng
        </label>

        {totalPages > 1 ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(Math.max(1, page - 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/[0.08] text-m3-on-surface disabled:opacity-35"
              aria-label="Trang trước"
            >
              <ChevronLeft size={16} />
            </button>
            {pageItems.map((item, idx) =>
              item === "ellipsis" ? (
                <span
                  key={`e-${idx}`}
                  className="inline-flex h-8 min-w-8 items-center justify-center px-1 text-[13px] font-semibold text-m3-on-surface-variant"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px] font-semibold ${
                    item === page
                      ? "bg-m3-primary text-white"
                      : "border border-black/[0.08] text-m3-on-surface hover:bg-m3-surface-high"
                  }`}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/[0.08] text-m3-on-surface disabled:opacity-35"
              aria-label="Trang sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AdminListShell({
  tabs,
  toolbar,
  children,
  page,
  totalPages,
  loading,
}: {
  tabs?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  page: number;
  totalPages: number;
  loading?: boolean;
}) {
  return (
    <div className="rounded-[16px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {tabs}
      {toolbar}
      <div className="max-h-[min(62vh,640px)] overflow-auto">{children}</div>
      {!loading && totalPages > 0 ? (
        <div className="border-t border-black/[0.05] px-4 py-3 text-[13px]">
          <span className="font-medium text-m3-on-surface-variant">
            Trang {page} / {totalPages}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function AdminTable({
  children,
  minWidth = "min-w-[880px]",
}: {
  children: ReactNode;
  minWidth?: string;
}) {
  return (
    <table className={`w-full ${minWidth} text-left`}>
      {children}
    </table>
  );
}

export function AdminTHead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-20">
      <tr className="border-b border-black/[0.06]">{children}</tr>
    </thead>
  );
}

export function adminRowClass(index: number, extra = "") {
  const stripe = index % 2 === 1 ? "bg-[#f8fafc]" : "bg-white";
  return `group border-b border-black/[0.04] transition-colors hover:bg-sky-50/70 ${stripe} ${extra}`;
}

export function AdminHoverActions({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
      <div className="flex items-center gap-0.5 rounded-lg border border-black/[0.06] bg-white/95 p-0.5 shadow-sm backdrop-blur-sm">
        {children}
      </div>
    </div>
  );
}

export function AdminIconBtn({
  title,
  onClick,
  disabled,
  tone = "gray",
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "gray" | "blue" | "green" | "red";
  children: ReactNode;
}) {
  const tones = {
    gray: "text-m3-on-surface-variant hover:bg-m3-primary/10 hover:text-m3-primary",
    blue: "text-m3-on-surface-variant hover:bg-sky-50 hover:text-sky-600",
    green: "text-m3-on-surface-variant hover:bg-emerald-50 hover:text-emerald-600",
    red: "text-m3-on-surface-variant hover:bg-red-50 hover:text-red-600",
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export function AdminPill({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold"
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  );
}

export function AdminPrimaryBtn({
  onClick,
  children,
  tone = "green",
  disabled = false,
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: "green" | "blue";
  disabled?: boolean;
}) {
  const cls =
    tone === "green"
      ? "bg-emerald-600 hover:bg-emerald-700"
      : "bg-m3-primary hover:opacity-90";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-bold text-white shadow-sm disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

export function AdminGhostBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 text-[13px] font-semibold text-m3-on-surface hover:bg-m3-surface-high"
    >
      {children}
    </button>
  );
}
