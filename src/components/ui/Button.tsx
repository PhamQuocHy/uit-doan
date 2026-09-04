"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** M3 Expressive button variants: filled / tonal / outlined / text + danger */
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

const variants = {
  primary:
    "bg-m3-primary text-m3-on-primary hover:bg-m3-primary-hover active:bg-m3-primary-active shadow-sm",
  secondary:
    "bg-m3-primary-container text-m3-on-primary-container hover:bg-m3-primary-container-hover",
  danger: "bg-m3-error text-m3-on-error hover:brightness-110",
  ghost:
    "bg-transparent text-m3-primary hover:bg-m3-on-surface/8 active:bg-m3-on-surface/12",
  outline:
    "bg-transparent border border-m3-outline-variant text-m3-primary hover:bg-m3-on-surface/8",
};

const sizes = {
  sm: "px-4 min-h-[34px] text-[13px]",
  md: "px-5 min-h-[40px] text-[15px]",
  lg: "px-7 min-h-[48px] text-[16px]",
};

/**
 * M3 Expressive button — pill shape, state-layer hover, expressive easing.
 */
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
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[0.01em] select-none",
          "transition-[background-color,box-shadow] duration-200 ease-[cubic-bezier(0.34,0.8,0.34,1)]",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none",
          variants[variant],
          sizes[size],
          className,
        )}
        style={style}
        {...props}
      >
        {loading ? (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
        ) : (
          icon
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
export default Button;
