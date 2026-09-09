"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  options: SearchableSelectOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** compact = bộ lọc header admin (pill); default = form login/modal */
  variant?: "default" | "compact";
  className?: string;
  triggerClassName?: string;
  ariaLabel?: string;
}

function normalizeVn(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/** M3 Expressive searchable select — filled surface trigger, elevated menu */
export default function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Chọn...",
  disabled = false,
  variant = "default",
  className = "",
  triggerClassName = "",
  ariaLabel,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const compact = variant === "compact";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const q = normalizeVn(search.trim());
  const filtered = q
    ? options.filter((o) => normalizeVn(o.label).includes(q))
    : options;

  const selected = options.find((o) => o.value === value);

  return (
    <div
      className={`relative ${compact ? "space-y-0" : "space-y-1"} ${
        isOpen ? "z-50" : "z-10"
      } ${className}`}
      ref={dropdownRef}
    >
      {label && (
        <label
          className="text-[12px] font-medium"
          style={{ color: "var(--m3-on-surface-variant)" }}
        >
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel || label || placeholder}
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={
          compact
            ? `flex h-9 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-full border border-black/[0.08] bg-white px-3.5 text-left text-[13px] font-medium text-m3-on-surface outline-none transition-colors hover:border-m3-primary/30 focus:border-m3-primary/40 focus:ring-2 focus:ring-m3-primary/10 ${
                isOpen ? "border-m3-primary/40 ring-2 ring-m3-primary/10" : ""
              } ${disabled ? "cursor-not-allowed opacity-40" : ""} ${triggerClassName}`
            : `flex w-full cursor-pointer items-center justify-between rounded-[16px] border border-transparent bg-m3-surface-low px-4 py-3 text-left text-[16px] outline-none transition-[background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.34,0.8,0.34,1)] focus-within:bg-m3-surface-lowest ${
                isOpen
                  ? "border-m3-primary bg-m3-surface-lowest ring-2 ring-m3-primary/15"
                  : ""
              } ${disabled ? "cursor-not-allowed opacity-40" : ""} ${triggerClassName}`
        }
        style={compact ? undefined : { color: "var(--m3-on-surface)" }}
      >
        <span
          className={`min-w-0 truncate ${selected ? "" : "text-m3-outline"}`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={compact ? 16 : 20}
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          style={{ color: "var(--m3-outline)" }}
        />
      </button>

      {isOpen && !disabled && (
        <div className="m3-menu-in absolute left-0 right-0 z-50 mt-1.5 min-w-[220px] overflow-hidden rounded-[16px] bg-white shadow-[0_16px_48px_rgba(0,0,0,0.18)] ring-1 ring-m3-outline-variant/40">
          <div className="border-b border-m3-outline-variant/40 bg-[#f7f9fb] p-2">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-m3-outline"
              />
              <input
                type="text"
                autoFocus
                className="w-full rounded-[10px] border border-m3-primary/40 bg-white py-2 pl-9 pr-3 text-sm text-m3-on-surface outline-none transition-colors focus:border-m3-primary focus:ring-2 focus:ring-m3-primary/15"
                placeholder="Tìm kiếm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsOpen(false);
                    setSearch("");
                  }
                }}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-4 text-center text-sm text-m3-outline">
                Không tìm thấy kết quả
              </div>
            ) : (
              filtered.map((opt) => (
                <button
                  type="button"
                  key={`${opt.value}::${opt.label}`}
                  className={
                    "flex w-full cursor-pointer px-4 py-2.5 text-left text-sm transition-colors duration-150 " +
                    (value === opt.value
                      ? "bg-m3-primary-container font-semibold text-m3-on-primary-container"
                      : "text-m3-on-surface hover:bg-m3-on-surface/8")
                  }
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch("");
                  }}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
      <style>{`
        @keyframes m3MenuIn {
          from { opacity: 0; transform: scale(0.96) translateY(-4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .m3-menu-in { animation: m3MenuIn 180ms cubic-bezier(0.38,1.21,0.22,1) both; transform-origin: top center; }
      `}</style>
    </div>
  );
}
