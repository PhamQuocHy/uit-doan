import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Quét NFC – NVQS",
  description: "Trang quét NFC CCCD gắn chip dành cho điện thoại",
};

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
        <style>
          {`@import url('https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap');`}
        </style>
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
