"use client";

import {
  useId,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { useM3Theme } from "./M3ThemeProvider";
import {
  m3Curves,
  m3Duration,
  m3FontSize,
  m3Rounding,
} from "./tokens";

/**
 * Soft rounded tray — like the notification search bar sample:
 * light gray shell + padded pill children inside.
 */
export function M3ToolbarTray({
  children,
  className,
  style,
  padding = 8,
  gap = 8,
  radius = m3Rounding.large,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  padding?: number;
  gap?: number;
  radius?: number;
}) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        gap,
        padding,
        borderRadius: radius,
        backgroundColor: "#f1f3f5",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type PillFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  error?: string | null;
  startIcon?: ReactNode;
  fullWidth?: boolean;
};

/**
 * White pill field for inside M3ToolbarTray (sample: "Tìm thông báo...").
 */
export function M3TrayPillField({
  label,
  error,
  startIcon,
  fullWidth = true,
  id: idProp,
  value,
  disabled,
  onFocus,
  onBlur,
  style,
  ...rest
}: PillFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const { palette } = useM3Theme();
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);
  const hasValue = String(value ?? "").length > 0;
  const floated = focused || hasValue;

  let borderColor = "transparent";
  if (hasError) borderColor = palette.colError;
  else if (focused) borderColor = palette.colPrimary;

  const fieldStyle: CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: fullWidth ? "100%" : undefined,
    flex: fullWidth ? 1 : undefined,
    minWidth: 0,
    height: 56,
    paddingLeft: startIcon ? 16 : 20,
    paddingRight: 20,
    borderRadius: m3Rounding.full,
    backgroundColor: focused ? "#ffffff" : "#eef1f4",
    border: `1.5px solid ${borderColor}`,
    boxSizing: "border-box",
    transition: [
      `background-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
      `border-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
      `box-shadow ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
    ].join(", "),
    boxShadow: focused ? "0 1px 2px rgba(26,115,232,0.10)" : "none",
    opacity: disabled ? 0.45 : 1,
  };

  const labelColor = hasError
    ? palette.colError
    : focused
      ? palette.colPrimary
      : "#475569";

  return (
    <div style={{ flex: fullWidth ? 1 : undefined, minWidth: 0, width: fullWidth ? "100%" : undefined }}>
      <div style={fieldStyle}>
        {startIcon ? (
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              width: 20,
              height: 20,
              marginRight: 10,
              color: floated ? labelColor : "#a0a7b0",
              transition: `color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
            }}
          >
            {startIcon}
          </span>
        ) : null}

        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <label
            htmlFor={id}
            style={{
              position: "absolute",
              left: 0,
              top: floated ? 2 : "50%",
              transform: floated ? "none" : "translateY(-50%)",
              fontSize: floated ? 11 : 16,
              fontWeight: floated ? 600 : 500,
              lineHeight: 1.2,
              color: floated ? labelColor : "#9aa1aa",
              pointerEvents: "none",
              transition: [
                `top ${m3Duration.expressiveFastSpatial}ms ${m3Curves.expressiveFastSpatial}`,
                `transform ${m3Duration.expressiveFastSpatial}ms ${m3Curves.expressiveFastSpatial}`,
                `font-size ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
                `color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
              ].join(", "),
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {label}
          </label>

          <input
            id={id}
            value={value}
            disabled={disabled}
            aria-invalid={hasError || undefined}
            aria-label={label}
            style={{
              width: "100%",
              border: 0,
              outline: "none",
              background: "transparent",
              font: "inherit",
              fontSize: m3FontSize.small,
              fontWeight: 500,
              color: palette.onSurface,
              caretColor: palette.colPrimary,
              paddingTop: floated ? 16 : 0,
              paddingBottom: floated ? 2 : 0,
              height: 52,
              boxSizing: "border-box",
              transition: `padding ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
              ...style,
            }}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...rest}
          />
        </div>
      </div>

      {error ? (
        <p
          style={{
            margin: "6px 0 0 14px",
            fontSize: m3FontSize.smaller,
            color: palette.colError,
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Compact tonal pill action — sample "Thời gian" chip */
export function M3TrayActionPill({
  children,
  startIcon,
  onClick,
  type = "button",
  disabled,
  style,
}: {
  children: ReactNode;
  startIcon?: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const { palette } = useM3Theme();
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        appearance: "none",
        border: 0,
        margin: 0,
        cursor: disabled ? "default" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        height: 48,
        padding: "0 16px",
        borderRadius: m3Rounding.full,
        backgroundColor: hovered ? "#e4eaf2" : "#eef1f4",
        color: palette.colPrimary,
        fontSize: m3FontSize.small,
        fontWeight: 600,
        whiteSpace: "nowrap",
        flexShrink: 0,
        transition: `background-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
        WebkitTapHighlightColor: "transparent",
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      {startIcon}
      {children}
    </button>
  );
}
