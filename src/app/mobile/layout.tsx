import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Nhận dạng AI",
  description: "Ứng dụng iOS quét NFC và OCR CCCD cho hệ thống NVQS",
  icons: { apple: "/app-icon.png" },
  appleWebApp: {
    capable: true,
    title: "Nhận dạng AI",
    statusBarStyle: "default",
  },
};

export default function MobileLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-[100dvh]">{children}</div>;
}
