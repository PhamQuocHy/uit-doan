"use client";

import {
  forwardRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Search } from "lucide-react";
import { M3TextField } from "./TextField";
import { useM3Theme } from "./M3ThemeProvider";
import {
  m3Curves,
  m3Duration,
  m3Rounding,
} from "./tokens";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  /** Animate width when text appears — SearchBar.qml behavior */
  animateWidth?: boolean;
  collapsedWidth?: number;
  expandedWidth?: number;
  startIcon?: ReactNode;
  endAdornment?: ReactNode;
  fullWidth?: boolean;
  containerStyle?: CSSProperties;
};

/**
 * Pill search field — port of `SearchBar.qml` / `ToolbarTextField.qml`
 * Collapsed → expanded width with expressive spatial easing.
 */
export const M3SearchField = forwardRef<HTMLInputElement, Props>(
  function M3SearchField(
    {
      animateWidth = true,
      collapsedWidth = 210,
      expandedWidth = 360,
      startIcon,
      endAdornment,
      value,
      defaultValue,
      onChange,
      fullWidth,
      containerStyle,
      style,
      ...rest
    },
    ref,
  ) {
    const { palette } = useM3Theme();
    const [focused, setFocused] = useState(false);
    const [inner, setInner] = useState(String(defaultValue ?? ""));
    const text = value !== undefined ? String(value) : inner;
    const expanded = focused || text.length > 0;

    const widthStyle: CSSProperties = fullWidth
      ? { width: "100%" }
      : {
          width: animateWidth ? (expanded ? expandedWidth : collapsedWidth) : collapsedWidth,
          transition: animateWidth
            ? `width 260ms cubic-bezier(0.2, 0, 0, 1), background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease`
            : undefined,
        };

    return (
      <M3TextField
        ref={ref}
        variant="pill"
        fullWidth={fullWidth}
        value={value}
        defaultValue={defaultValue}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e as React.FocusEvent<HTMLInputElement>);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e as React.FocusEvent<HTMLInputElement>);
        }}
        onChange={(e) => {
          if (value === undefined) setInner(e.target.value);
          onChange?.(e);
        }}
        startAdornment={
          startIcon ?? (
            <Search size={18} strokeWidth={2.2} color={focused ? palette.colPrimary : "#5f6368"} />
          )
        }
        endAdornment={endAdornment}
        containerStyle={{
          minHeight: 42,
          height: 42,
          padding: "0 14px",
          borderRadius: m3Rounding.full,
          backgroundColor: focused ? "#ffffff" : (text ? "#eef3fb" : "#f0f4f9"),
          border: focused ? "1px solid #1a73e8" : "1px solid transparent",
          boxShadow: focused
            ? "0 1px 3px 1px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.12)"
            : "none",
          ...widthStyle,
          ...containerStyle,
        }}
        style={style}
        {...rest}
      />
    );
  },
);

/** Duration constant exposed for consumers matching SearchBar */
export const M3_SEARCH_WIDTH_MS = m3Duration.elementResize;
