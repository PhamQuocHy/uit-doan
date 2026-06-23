"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import Topbar from "@/components/admin/Topbar";

const pageTitles: Record<string, string> = {
  "/admin": "Tổng quan",
  "/admin/citizens": "Quản lý Công dân",
  "/admin/education": "Học vấn & Việc làm",
  "/admin/health": "Hồ sơ Sức khỏe",
  "/admin/residence": "Biến động Cư trú",
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
}: {
  children: React.ReactNode;
  userName: string;
  userRole: string;
  userHierarchyLevel: string;
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
    <div className="min-h-screen" style={{ background: "#f8fafb" }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        onLogout={handleLogout}
        userName={userName}
        userRole={userRole}
        userHierarchyLevel={userHierarchyLevel}
      />
      <div
        className="transition-all duration-300 flex flex-col min-h-screen"
        style={{ marginLeft: collapsed ? 64 : 288 }}
      >
        <Topbar
          title={title}
          userName={userName}
          userRole={userRole}
          onLogout={handleLogout}
          onMenuToggle={() => setCollapsed(!collapsed)}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
