"use client";

import { InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => {
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
        <div className="relative">
          {icon && (
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "#6b7c2e" }}
            >
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={clsx(
              "w-full rounded-xl text-sm transition-all duration-150",
              icon ? "pl-10 pr-3 py-2.5" : "px-3 py-2.5",
              className,
            )}
            style={{
              background: error ? "rgba(185,68,32,0.05)" : "#f4f3ee",
              border: error
                ? "1.5px solid rgba(185,68,32,0.4)"
                : "1.5px solid #cdd3a5",
              color: "#1c2010",
              outline: "none",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#4b5320";
              e.target.style.background = "#fff";
              e.target.style.boxShadow = "0 0 0 3px rgba(75,83,32,0.1)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = error
                ? "rgba(185,68,32,0.4)"
                : "#cdd3a5";
              e.target.style.background = "#f4f3ee";
              e.target.style.boxShadow = "none";
            }}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs font-medium" style={{ color: "#b94420" }}>
            {error}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";
export default Input;
