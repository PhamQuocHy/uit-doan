import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hệ thống quản lý dữ liệu nghĩa vụ quân sự",
  description:
    "Hệ thống quản lý các thông tin nghĩa vụ quân sự của các cấp từ Tỉnh đến các xã trực thuộc",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <style>
          {`@import url('https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap');`}
        </style>
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
