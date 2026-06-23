"use client";

import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "#3a4118" }}
          >
            {label}
            {props.required && (
              <span className="ml-1" style={{ color: "#b94420" }}>
                *
              </span>
            )}
          </label>
        )}
        <select
          ref={ref}
          className="w-full rounded-xl text-sm px-3 py-2.5 transition-all duration-150"
          style={{
            background: "#f4f3ee",
            border: "1.5px solid #cdd3a5",
            color: "#1c2010",
            outline: "none",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "#4b5320";
            e.currentTarget.style.background = "#fff";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(75,83,32,0.1)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#cdd3a5";
            e.currentTarget.style.background = "#f4f3ee";
            e.currentTarget.style.boxShadow = "none";
          }}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-xs font-medium" style={{ color: "#b94420" }}>
            {error}
          </p>
        )}
      </div>
    );
  },
);
Select.displayName = "Select";
export default Select;
