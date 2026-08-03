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
      className={`space-y-1 relative ${isOpen ? "z-50" : "z-10"}`}
      ref={dropdownRef}
    >
      {label && (
        <label className="text-sm font-medium" style={{ color: "#636366" }}>
          {label}
        </label>
      )}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-3.5 text-[16px] rounded-xl transition-all outline-none flex justify-between items-center ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        style={{
          background: "#fff",
          border: isOpen ? "1.5px solid #007aff" : "1.5px solid #e5e5ea",
          color: "#1d1d1f",
          boxShadow: isOpen ? "0 0 0 3px rgba(116,140,44,0.1)" : "none",
        }}
      >
        <span className={selected ? "" : "text-gray-500"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={20}
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          style={{ color: "#86868b" }}
        />
      </div>

      {isOpen && !disabled && (
        <div
          className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border overflow-hidden"
          style={{
            borderColor: "#e5e5ea",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
          }}
        >
          <div
            className="p-2 border-b"
            style={{ borderColor: "#e5e5ea", backgroundColor: "#f5f5f7" }}
          >
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                style={{ color: "#86868b" }}
              />
              <input
                type="text"
                autoFocus
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg outline-none bg-white border border-[#e5e5ea] focus:border-[#007aff] transition-colors"
                placeholder="Tìm kiếm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="px-4 py-4 text-sm text-gray-500 text-center">
                Không tìm thấy kết quả
              </div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={opt.value}
                  className={`px-4 py-3 text-sm cursor-pointer transition-colors ${
                    value === opt.value ? "font-medium" : "hover:bg-gray-50"
                  }`}
                  style={{
                    color: value === opt.value ? "#007aff" : "#1d1d1f",
                    backgroundColor: value === opt.value ? "#e5e5ea" : "",
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
    </div>
  );
}
