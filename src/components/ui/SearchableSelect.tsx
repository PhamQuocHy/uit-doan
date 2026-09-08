"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  options: Option[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** M3 Expressive searchable select — filled surface trigger, elevated menu */
export default function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Chọn...",
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );

  const selected = options.find((o) => o.value === value);

  return (
    <div
      className={`relative space-y-1 ${isOpen ? "z-50" : "z-10"}`}
      ref={dropdownRef}
    >
      {label && (
        <label className="text-[12px] font-medium" style={{ color: "var(--m3-on-surface-variant)" }}>
          {label}
        </label>
      )}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={
          "flex w-full cursor-pointer items-center justify-between rounded-[16px] bg-m3-surface-low px-4 py-3 text-[16px] outline-none " +
          "border border-transparent transition-[background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.34,0.8,0.34,1)] " +
          "focus-within:bg-m3-surface-lowest " +
          (isOpen
            ? "bg-m3-surface-lowest border-m3-primary ring-2 ring-m3-primary/15 "
            : "") +
          (disabled ? "cursor-not-allowed opacity-40" : "")
        }
        style={{ color: "var(--m3-on-surface)" }}
      >
        <span className={selected ? "" : "text-m3-outline"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={20}
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          style={{ color: "var(--m3-outline)" }}
        />
      </div>

      {isOpen && !disabled && (
        <div
          className="m3-menu-in absolute z-50 mt-2 w-full overflow-hidden rounded-[20px] bg-m3-surface-lowest shadow-[0_16px_48px_rgba(0,0,0,0.18)] ring-1 ring-m3-outline-variant/40"
        >
          <div className="border-b border-m3-outline-variant/40 bg-m3-surface-low p-2">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--m3-outline)" }}
              />
              <input
                type="text"
                autoFocus
                className="w-full rounded-full border border-transparent bg-m3-surface-container py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-m3-primary"
                placeholder="Tìm kiếm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="px-4 py-4 text-center text-sm text-m3-outline">
                Không tìm thấy kết quả
              </div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={opt.value}
                  className={
                    "cursor-pointer px-4 py-3 text-sm transition-colors duration-150 " +
                    (value === opt.value
                      ? "bg-m3-primary-container font-semibold"
                      : "hover:bg-m3-on-surface/8")
                  }
                  style={{
                    color:
                      value === opt.value
                        ? "var(--m3-on-primary-container)"
                        : "var(--m3-on-surface)",
                  }}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch("");
                  }}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      <style>{`
        @keyframes m3MenuIn {
          from { opacity: 0; transform: scale(0.92) translateY(-6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .m3-menu-in { animation: m3MenuIn 250ms cubic-bezier(0.38,1.21,0.22,1) both; transform-origin: top center; }
      `}</style>
    </div>
  );
}
