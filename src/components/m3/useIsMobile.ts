"use client";

import { useEffect, useState } from "react";

/** Tiny matchMedia hook (replaces MUI useMediaQuery) */
export function useIsMobile(breakpointPx = 600) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpointPx]);
  return isMobile;
}
