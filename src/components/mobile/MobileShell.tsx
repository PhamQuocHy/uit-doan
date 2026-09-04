"use client";

import type { ReactNode } from "react";
import { M3Card, M3RippleButton, M3ThemeProvider } from "@/components/m3";

const MOBILE_PRIMARY = "#748c2c";

export function MobileShell({
  children,
  title = "Nhận dạng AI",
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <M3ThemeProvider mode="light" primary={MOBILE_PRIMARY}>
      <div
        className="flex min-h-[100dvh] flex-col bg-m3-surface-low text-m3-on-surface"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <header className="px-5 pb-2 pt-4 text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-m3-primary">
            NVQS
          </p>
          <h1 className="text-xl font-bold text-m3-on-surface">{title}</h1>
        </header>
        <main className="flex flex-1 flex-col px-4 pb-6">{children}</main>
      </div>
    </M3ThemeProvider>
  );
}

export function MobileCard({ children }: { children: ReactNode }) {
  return (
    <M3Card variant="elevated" className="mx-auto w-full max-w-md">
      <div className="space-y-4 p-5">{children}</div>
    </M3Card>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <M3RippleButton
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full justify-center"
    >
      {children}
    </M3RippleButton>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <M3RippleButton
      type="button"
      variant="outlined"
      onClick={onClick}
      disabled={disabled}
      className="w-full justify-center"
    >
      {children}
    </M3RippleButton>
  );
}
