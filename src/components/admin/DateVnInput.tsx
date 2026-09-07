"use client";

import { useEffect, useState } from "react";
import { isoToVn, maskVnDateInput, vnToIso } from "@/lib/date-vn";

type DateVnInputProps = {
  valueIso: string;
  onChangeIso: (iso: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
};

/** Ô nhập ngày dd/mm/yyyy, lưu nội bộ yyyy-MM-dd. */
export default function DateVnInput({
  valueIso,
  onChangeIso,
  required,
  className,
  placeholder = "dd/mm/yyyy",
}: DateVnInputProps) {
  const [text, setText] = useState(() => isoToVn(valueIso));

  useEffect(() => {
    setText(isoToVn(valueIso));
  }, [valueIso]);

  return (
    <input
      className={className}
      inputMode="numeric"
      placeholder={placeholder}
      value={text}
      required={required}
      onChange={(e) => {
        const next = maskVnDateInput(e.target.value);
        setText(next);
        if (next.length === 10) {
          onChangeIso(vnToIso(next));
        } else if (!next) {
          onChangeIso("");
        }
      }}
      onBlur={() => {
        if (!text) {
          onChangeIso("");
          return;
        }
        const iso = vnToIso(text);
        if (iso) {
          onChangeIso(iso);
          setText(isoToVn(iso));
        } else {
          setText(isoToVn(valueIso));
        }
      }}
    />
  );
}
