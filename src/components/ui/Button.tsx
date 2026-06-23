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
    background: "linear-gradient(135deg, #3a4118 0%, #4b5320 100%)",
    color: "#f4f3ee",
    border: "1px solid #6b7c2e",
    boxShadow: "0 2px 8px rgba(75,83,32,0.3)",
  },
  secondary: {
    background: "#e5e8d0",
    color: "#2b3012",
    border: "1px solid #cdd3a5",
  },
  danger: {
    background: "#b94420",
    color: "#fff",
    border: "1px solid #9a3519",
    boxShadow: "0 2px 8px rgba(185,68,32,0.3)",
  },
  ghost: {
    background: "transparent",
    color: "#4b5320",
    border: "1px solid transparent",
  },
  outline: {
    background: "#fff",
    color: "#3a4118",
    border: "1px solid #cdd3a5",
    boxShadow: "0 1px 3px rgba(28,32,16,0.08)",
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
      sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
      md: "px-4 py-2 text-sm rounded-xl gap-2",
      lg: "px-6 py-3 text-sm rounded-xl gap-2 tracking-wide font-bold",
    };
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          "inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer uppercase tracking-wide",
          sizes[size],
          className,
        )}
        style={{ ...variantStyles[variant], ...style }}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
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
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
export default Button;
