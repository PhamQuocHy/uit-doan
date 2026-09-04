"use client";

import {
  forwardRef,
  useId,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type TextareaHTMLAttributes,
} from "react";
import { useM3Theme } from "./M3ThemeProvider";
import {
  m3Curves,
  m3Duration,
  m3FontSize,
  m3Rounding,
} from "./tokens";

type CommonProps = {
  label?: string;
  supportingText?: string;
  error?: string | null;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  /** filled = surfaceContainerLow pill/rounded; outlined = border */
  variant?: "filled" | "outlined" | "pill";
  fullWidth?: boolean;
  containerStyle?: CSSProperties;
};

type InputProps = CommonProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
    multiline?: false;
  };

type TextAreaProps = CommonProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    multiline: true;
  };

/**
 * Material text field — ports `MaterialTextField.qml` + `ToolbarTextField.qml`
 * (filled / outlined / pill search-style).
 */
export const M3TextField = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  InputProps | TextAreaProps
>(function M3TextField(props, ref) {
  const {
    label,
    supportingText,
    error,
    startAdornment,
    endAdornment,
    variant = "filled",
    fullWidth,
    containerStyle,
    disabled,
    id: idProp,
    ...rest
  } = props;
  const autoId = useId();
  const id = idProp ?? autoId;
  const { palette } = useM3Theme();
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);

  const isPill = variant === "pill";
  const isOutlined = variant === "outlined";

  const radius = isPill ? m3Rounding.full : m3Rounding.small;

  let bg = palette.colLayer1;
  let border = "1.5px solid transparent";
  if (isOutlined) {
    bg = palette.surface;
    border = `1.5px solid ${
      hasError
        ? palette.colError
        : focused
          ? palette.colPrimary
          : palette.colOutlineVariant
    }`;
  } else if (focused) {
    bg = palette.surface;
    border = `1.5px solid ${hasError ? palette.colError : palette.colPrimary}`;
  } else if (hasError) {
    border = `1.5px solid ${palette.colError}`;
  }

  const fieldStyle: CSSProperties = {
    display: "flex",
    alignItems: props.multiline ? "flex-start" : "center",
    gap: 8,
    width: fullWidth ? "100%" : undefined,
    minHeight: isPill ? 40 : 48,
    padding: isPill ? "8px 16px" : "12px 16px",
    borderRadius: radius,
    backgroundColor: bg,
    border,
    transition: [
      `background-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
      `border-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
    ].join(", "),
    opacity: disabled ? 0.4 : 1,
    ...containerStyle,
  };

  const controlStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    border: 0,
    outline: "none",
    background: "transparent",
    font: "inherit",
    fontSize: m3FontSize.small,
    color: palette.colOnLayer1,
    caretColor: palette.colPrimary,
    resize: props.multiline ? "vertical" : undefined,
    lineHeight: 1.4,
  };

  return (
    <div style={{ width: fullWidth ? "100%" : undefined }}>
      {label ? (
        <label
          htmlFor={id}
          style={{
            display: "block",
            marginBottom: 6,
            fontSize: m3FontSize.smaller,
            fontWeight: 500,
            color: hasError ? palette.colError : palette.colOnSurfaceVariant,
          }}
        >
          {label}
        </label>
      ) : null}

      <div style={fieldStyle}>
        {startAdornment ? (
          <span
            style={{
              display: "inline-flex",
              color: palette.colSubtext,
              flexShrink: 0,
              marginTop: props.multiline ? 2 : 0,
            }}
          >
            {startAdornment}
          </span>
        ) : null}

        {props.multiline ? (
          <textarea
            id={id}
            ref={ref as Ref<HTMLTextAreaElement>}
            disabled={disabled}
            {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
            style={{
              ...controlStyle,
              ...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>).style,
              outline: "none",
              border: 0,
              boxShadow: "none",
            }}
            onFocus={(e) => {
              setFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              props.onBlur?.(e);
            }}
          />
        ) : (
          <input
            id={id}
            ref={ref as Ref<HTMLInputElement>}
            disabled={disabled}
            {...(rest as InputHTMLAttributes<HTMLInputElement>)}
            style={{
              ...controlStyle,
              ...(rest as InputHTMLAttributes<HTMLInputElement>).style,
              outline: "none",
              border: 0,
              boxShadow: "none",
            }}
            onFocus={(e) => {
              setFocused(true);
              (rest as InputHTMLAttributes<HTMLInputElement>).onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              (rest as InputHTMLAttributes<HTMLInputElement>).onBlur?.(e);
            }}
          />
        )}

        {endAdornment ? (
          <span
            style={{
              display: "inline-flex",
              color: palette.colSubtext,
              flexShrink: 0,
            }}
          >
            {endAdornment}
          </span>
        ) : null}
      </div>

      {error || supportingText ? (
        <p
          style={{
            margin: "4px 2px 0",
            fontSize: m3FontSize.smaller,
            color: hasError ? palette.colError : palette.colSubtext,
          }}
        >
          {error || supportingText}
        </p>
      ) : null}

      <style>{`
        input::placeholder, textarea::placeholder {
          color: ${palette.colSubtext};
          opacity: 1;
        }
        input::selection, textarea::selection {
          background: ${palette.colSecondaryContainer};
          color: ${palette.colOnSecondaryContainer};
        }
      `}</style>
    </div>
  );
});
