"use client";

import {
  createContext,
  useContext,
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

type FieldKey = string;

type GroupCtx = {
  focusedKey: FieldKey | null;
  setFocusedKey: (key: FieldKey | null) => void;
  pressedKey: FieldKey | null;
  setPressedKey: (key: FieldKey | null) => void;
  height: number;
  spacing: number;
};

const ExpressiveGroupContext = createContext<GroupCtx | null>(null);

/**
 * M3 Expressive connected field row — same shape rules as
 * SelectionGroupButton.qml:
 * - focused (or end) segment → radius = height/2 (full pill)
 * - unfocused middle edge → unsharpenmore (6px)
 * Overall reads as one incomplete pill track.
 */
export function M3ExpressiveFieldGroup({
  children,
  spacing = 3,
  height = 56,
  className,
  style,
  trailing,
}: {
  children: ReactNode;
  spacing?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
  /** e.g. circular search button */
  trailing?: ReactNode;
}) {
  const [focusedKey, setFocusedKey] = useState<FieldKey | null>(null);
  const [pressedKey, setPressedKey] = useState<FieldKey | null>(null);

  return (
    <ExpressiveGroupContext.Provider
      value={{
        focusedKey,
        setFocusedKey,
        pressedKey,
        setPressedKey,
        height,
        spacing,
      }}
    >
      <div
        className={className}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          width: "100%",
          gap: spacing,
          ...style,
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            minWidth: 0,
            alignItems: "stretch",
            gap: spacing,
          }}
        >
          {children}
        </div>
        {trailing ? (
          <div style={{ flexShrink: 0, alignSelf: "center" }}>{trailing}</div>
        ) : null}
      </div>
    </ExpressiveGroupContext.Provider>
  );
}

type SegmentProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  fieldKey: FieldKey;
  label: string;
  error?: string | null;
  startIcon?: ReactNode;
  /** Position in the connected group */
  position: "start" | "middle" | "end" | "only";
};

export function M3ExpressiveFieldSegment({
  fieldKey,
  label,
  error,
  startIcon,
  position,
  id: idProp,
  value,
  disabled,
  onFocus,
  onBlur,
  style,
  ...rest
}: SegmentProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const { palette } = useM3Theme();
  const group = useContext(ExpressiveGroupContext);
  const height = group?.height ?? 56;
  const focused = group?.focusedKey === fieldKey;
  const pressed = group?.pressedKey === fieldKey;
  const hasError = Boolean(error);
  const hasValue = String(value ?? "").length > 0;
  const floated = focused || hasValue;

  const pill = height / 2;
  const soft = m3Rounding.unsharpenmore; // 6 — incomplete pill edge
  const pressedSoft = m3Rounding.unsharpen; // 2 — squash on press

  // SelectionGroupButton: (toggled || leftmost) ? height/2 : unsharpenmore
  const isStart = position === "start" || position === "only";
  const isEnd = position === "end" || position === "only";

  let leftRadius = focused || isStart ? pill : soft;
  let rightRadius = focused || isEnd ? pill : soft;

  // Press morph — slightly tighter radius (GroupButton buttonRadiusPressed)
  if (pressed) {
    leftRadius = focused || isStart ? pill - 2 : pressedSoft;
    rightRadius = focused || isEnd ? pill - 2 : pressedSoft;
  }

  const idleFill = "#eef1f4";
  const hoverFill = "#e6eaef";
  const activeFill = focused ? "#ffffff" : idleFill;

  let borderColor = "transparent";
  if (hasError) borderColor = palette.colError;
  else if (focused) borderColor = palette.colPrimary;

  // Bounce width: GroupButton expands neighbors when pressed
  const bouncePad = pressed ? (isStart || isEnd ? 4 : 8) : 0;

  const segmentStyle: CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: "100%",
    height,
    paddingLeft: (startIcon ? 14 : 18) + bouncePad,
    paddingRight: 16 + bouncePad,
    borderTopLeftRadius: leftRadius,
    borderBottomLeftRadius: leftRadius,
    borderTopRightRadius: rightRadius,
    borderBottomRightRadius: rightRadius,
    backgroundColor: activeFill,
    border: `1.5px solid ${borderColor}`,
    boxSizing: "border-box",
    transition: [
      `border-radius ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
      `padding ${m3Duration.clickBounce}ms ${m3Curves.expressiveDefaultSpatial}`,
      `background-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
      `border-color ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
      `box-shadow ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
    ].join(", "),
    opacity: disabled ? 0.45 : 1,
    boxShadow: focused
      ? "0 1px 3px rgba(26,115,232,0.14)"
      : "none",
    zIndex: focused ? 2 : 1,
  };

  const labelColor = hasError
    ? palette.colError
    : focused
      ? palette.colPrimary
      : "#475569";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: focused || pressed ? "1.12 1 0%" : "1 1 0%",
        minWidth: 0,
        transition: `flex ${m3Duration.clickBounce}ms ${m3Curves.expressiveDefaultSpatial}`,
      }}
    >
      <div
        style={segmentStyle}
        onMouseEnter={(e) => {
          if (!focused && !disabled) {
            e.currentTarget.style.backgroundColor = hoverFill;
          }
        }}
        onMouseLeave={(e) => {
          if (!focused && !disabled) {
            e.currentTarget.style.backgroundColor = idleFill;
          }
          group?.setPressedKey(null);
        }}
        onMouseDown={() => group?.setPressedKey(fieldKey)}
        onMouseUp={() => group?.setPressedKey(null)}
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
              height: height - 4,
              boxSizing: "border-box",
              transition: `padding ${m3Duration.expressiveEffects}ms ${m3Curves.expressiveEffects}`,
              ...style,
            }}
            onFocus={(e) => {
              group?.setFocusedKey(fieldKey);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              group?.setFocusedKey(null);
              group?.setPressedKey(null);
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
