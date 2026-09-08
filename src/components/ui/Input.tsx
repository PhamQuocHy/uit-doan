"use client";

import { M3TextField } from "@/components/m3";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  multiline?: false;
};

type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  multiline: true;
};

/** M3 filled text field (label + supporting error) */
export default function Input(props: Props | AreaProps) {
  const { label, error, icon, className, multiline, ...rest } = props as Props;
  return (
    <M3TextField
      {...(rest as InputHTMLAttributes<HTMLInputElement>)}
      label={label}
      error={error ?? null}
      startAdornment={icon}
      fullWidth
      variant="filled"
    />
  );
}
