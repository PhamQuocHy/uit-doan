"use client";

import { SelectHTMLAttributes, forwardRef } from "react";
import { ChevronDown } from "lucide-react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

/** M3 Expressive select — filled tonal surface, expressive focus ring */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, style, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            className="text-[12px] font-medium"
            style={{ color: error ? "var(--m3-error)" : "var(--m3-on-surface-variant)" }}
          >
            {label}
            {props.required && (
              <span className="ml-1" style={{ color: "var(--m3-error)" }}>
                *
              </span>
            )}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={
              "w-full appearance-none rounded-[16px] px-4 py-2.5 text-[15px] outline-none " +
              "bg-m3-surface-low border border-transparent " +
              "transition-[background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.34,0.8,0.34,1)] " +
              "focus:bg-m3-surface-lowest focus:border-m3-primary focus:ring-2 focus:ring-m3-primary/15 " +
              (className || "")
            }
            style={{ color: "var(--m3-on-surface)", ...style }}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={17}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--m3-outline)" }}
          />
        </div>
        {error && (
          <p className="text-[12px] font-medium" style={{ color: "var(--m3-error)" }}>
            {error}
          </p>
        )}
      </div>
    );
  },
);
Select.displayName = "Select";
export default Select;
