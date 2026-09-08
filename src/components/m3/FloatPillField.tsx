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

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  error?: string | null;
  startIcon?: ReactNode;
  fullWidth?: boolean;
  containerStyle?: CSSProperties;
};

/**
 * Filled pill field matching the login lookup sample:
 * soft cool-gray fill, full pill, leading icon, floating label.
 */
export function M3FloatPillField({
  label,
  error,
  startIcon,
  fullWidth = true,
  containerStyle,
  id: idProp,
  value,
  disabled,
  onFocus,
  onBlur,
  style,
  ...rest
}: Props) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const { palette } = useM3Theme();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hasError = Boolean(error);
  const hasValue = String(value ?? "").length > 0;
  const floated = focused || hasValue;

  // Cool soft gray like the sample (not warm M3 surface)
  const idleFill = "#eef1f4";
  const hoverFill = "#e6eaef";

  let bg = idleFill;
  if (focused) bg = "#ffffff";
  else if (hovered) bg = hoverFill;

  let borderColor = "transparent";
  if (hasError) borderColor = palette.colError;
  else if (focused) borderColor = palette.colPrimary;

  const fieldStyle: CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: fullWidth ? "100%" : undefined,
    height: 56,
    paddingLeft: startIcon ? 16 : 20,
    paddingRight: 20,
    borderRadius: m3Rounding.full,
    backgroundColor: bg,
    border: `1.5px solid ${borderColor}`,
    boxSizing: "border-box",
    transition: [
      `background-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
      `border-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
    ].join(", "),
    opacity: disabled ? 0.45 : 1,
    ...containerStyle,
  };

  const labelColor = hasError
    ? palette.colError
    : focused
      ? palette.colPrimary
      : "#475569";

  return (
    <div style={{ width: fullWidth ? "100%" : undefined, minWidth: 0, flex: 1 }}>
      <div
        style={fieldStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {startIcon ? (
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              width: 22,
              height: 22,
              marginRight: 10,
              color: floated ? labelColor : "#94a3b8",
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
              top: floated ? 3 : "50%",
              transform: floated ? "none" : "translateY(-50%)",
              fontSize: floated ? 12 : 16,
              fontWeight: floated ? 600 : 500,
              lineHeight: 1.2,
              color: floated ? labelColor : "#94a3b8",
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
              fontSize: m3FontSize.normal,
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
            margin: "6px 0 0 16px",
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
