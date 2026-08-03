"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles = {
  primary: {
    background: "linear-gradient(180deg, #3395ff 0%, #007aff 100%)",
    color: "#ffffff",
    border: "1px solid rgba(0,122,255,0.35)",
    boxShadow: "0 1px 2px rgba(0,122,255,0.25)",
  },
  secondary: {
    background: "#f5f5f7",
    color: "#1d1d1f",
    border: "1px solid rgba(0,0,0,0.08)",
  },
  danger: {
    background: "#ff3b30",
    color: "#fff",
    border: "1px solid #ff3b30",
    boxShadow: "0 1px 2px rgba(255,59,48,0.25)",
  },
  ghost: {
    background: "transparent",
    color: "#007aff",
    border: "1px solid transparent",
  },
  outline: {
    background: "#fff",
    color: "#007aff",
    border: "1px solid rgba(0,122,255,0.35)",
  },
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      children,
      className,
      disabled,
      style,
      ...props
    },
    ref,
  ) => {
    const sizes = {
      sm: "min-h-[36px] px-3.5 py-2 text-[13px] rounded-[10px] gap-1.5",
      md: "min-h-[44px] px-5 py-2.5 text-[15px] rounded-[12px] gap-2",
      lg: "min-h-[52px] px-7 py-3 text-[16px] rounded-[14px] gap-2.5 font-bold",
    };
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          "inline-flex items-center justify-center font-semibold transition-all duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          sizes[size],
          className,
        )}
        style={{ ...variantStyles[variant], ...style }}
        {...props}
      >
        {loading ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
export default Button;
