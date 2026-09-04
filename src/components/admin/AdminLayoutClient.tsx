"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import Topbar from "@/components/admin/Topbar";
import AiChatWidget from "@/components/admin/AiChatWidget";
import { M3ThemeProvider } from "@/components/m3";

const pageTitles: Record<string, string> = {
  "/admin": "Tổng quan",
  "/admin/citizens": "Hồ sơ công dân",
  "/admin/ai-voice": "Nhận dạng CCCD (Voice)",
  "/admin/ai-face": "Nhận dạng Khuôn mặt",
  "/admin/recruitment": "Đợt khám tuyển",
  "/admin/quota": "Giao chỉ tiêu",
  "/admin/approval": "Xét duyệt danh sách",
  "/admin/reserve": "Quân nhân dự bị",
  "/admin/training": "Huấn luyện & Diễn tập",
  "/admin/documents": "Công văn đến/đi",
  "/admin/receiving": "Đơn vị nhận quân",
  "/admin/document-archive": "Kho văn bản",
  "/admin/reports": "Báo cáo & Thống kê",
  "/admin/users": "Quản lý Thành viên",
  "/admin/departments": "Quản lý đơn vị",
  "/admin/roles": "Vai trò & Quyền hạn",
  "/admin/logs": "Nhật ký hệ thống",
  "/admin/settings": "Cài đặt hệ thống",
};

export default function AdminLayoutClient({
  children,
  userName,
  userRole,
  userHierarchyLevel,
  userFunctionalRole,
}: {
  children: React.ReactNode;
  userName: string;
  userRole: string;
  userHierarchyLevel: string;
  userFunctionalRole: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const title = pageTitles[pathname] || "Admin";

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <M3ThemeProvider mode="light" primary="#1a73e8">
      <div className="min-h-screen bg-m3-background text-m3-on-surface">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          onLogout={handleLogout}
          userName={userName}
          userRole={userRole}
          userHierarchyLevel={userHierarchyLevel}
          userFunctionalRole={userFunctionalRole}
        />
        <div
          className="flex min-h-screen flex-col transition-[margin] duration-300 ease-[cubic-bezier(0.34,0.8,0.34,1)]"
          style={{ marginLeft: collapsed ? 84 : 300 }}
        >
          <Topbar
            title={title}
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onMenuToggle={() => setCollapsed(!collapsed)}
          />
          <main className="!rounded-tl-[28px] flex-1 overflow-auto bg-m3-surface-lowest px-5 pb-8 pt-6 sm:px-7 sm:pt-7">
            {children}
          </main>
        </div>
        <AiChatWidget />
      </div>
    </M3ThemeProvider>
  );
}
