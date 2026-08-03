"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronUp, ChevronDown } from "lucide-react";
import {
  FcHome,
  FcConferenceCall,
  FcVoicePresentation,
  FcCameraIdentification,
  FcCalendar,
  FcBullish,
  FcApproval,
  FcSportsMode,
  FcTodoList,
  FcDocument,
  FcFilingCabinet,
  FcBarChart,
  FcManager,
  FcKey,
  FcClock,
  FcSettings,
} from "react-icons/fc";
import { clsx } from "clsx";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

const ICON = 22;

const navGroups: NavGroup[] = [
  {
    name: "Hồ sơ thanh niên",
    items: [
      { href: "/admin", label: "Tổng quan", icon: <FcHome size={ICON} /> },
      { href: "/admin/citizens", label: "Hồ sơ công dân", icon: <FcConferenceCall size={ICON} /> },
    ],
  },
  {
    name: "Nhận dạng AI",
    items: [
      { href: "/admin/ai-voice", label: "Đọc CCCD bằng giọng nói", icon: <FcVoicePresentation size={ICON} /> },
      { href: "/admin/ai-face", label: "Nhận diện khuôn mặt", icon: <FcCameraIdentification size={ICON} /> },
    ],
  },
  {
    name: "Tuyển quân",
    items: [
      { href: "/admin/recruitment", label: "Đợt khám tuyển", icon: <FcCalendar size={ICON} /> },
      { href: "/admin/quota", label: "Giao chỉ tiêu", icon: <FcBullish size={ICON} /> },
      { href: "/admin/approval", label: "Xét duyệt danh sách", icon: <FcApproval size={ICON} /> },
    ],
  },
  {
    name: "Huấn luyện",
    items: [
      { href: "/admin/training", label: "Huấn luyện & diễn tập", icon: <FcSportsMode size={ICON} /> },
    ],
  },
  {
    name: "Đơn vị nhận quân",
    items: [
      { href: "/admin/receiving", label: "Nhận danh sách quân", icon: <FcTodoList size={ICON} /> },
    ],
  },
  {
    name: "Văn bản",
    items: [
      { href: "/admin/documents", label: "Công văn đến / đi", icon: <FcDocument size={ICON} /> },
      { href: "/admin/document-archive", label: "Kho văn bản", icon: <FcFilingCabinet size={ICON} /> },
    ],
  },
  {
    name: "Báo cáo",
    items: [
      { href: "/admin/reports", label: "Báo cáo & thống kê", icon: <FcBarChart size={ICON} /> },
    ],
  },
  {
    name: "Quản trị",
    items: [
      { href: "/admin/users", label: "Thành viên", icon: <FcManager size={ICON} /> },
      { href: "/admin/roles", label: "Vai trò & quyền", icon: <FcKey size={ICON} /> },
      { href: "/admin/logs", label: "Nhật ký hệ thống", icon: <FcClock size={ICON} /> },
      { href: "/admin/settings", label: "Cài đặt", icon: <FcSettings size={ICON} /> },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
  userName: string;
  userRole: string;
  userHierarchyLevel: string;
}

export default function Sidebar({
  collapsed,
  userHierarchyLevel,
}: SidebarProps) {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(navGroups.map((g) => [g.name, false])),
  );

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 z-40 flex h-screen flex-col transition-all duration-300",
        collapsed ? "w-[84px]" : "w-[300px]",
      )}
      style={{ background: "#f8fafb" }}
    >
      <div className="flex h-[64px] shrink-0 items-center gap-3 px-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[12px]"
          style={{ background: "#e8f2ff" }}
        >
          <img
            src="/images/logo_qd.png"
            alt="Logo"
            className="h-6 w-6 object-contain"
          />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-[17px] font-bold tracking-tight text-[#1f2937]">
              YMSA
            </p>
            <p className="truncate text-[12px] font-medium text-[#6b7280]">
              Nghĩa vụ quân sự
            </p>
          </div>
        )}
      </div>

      <nav className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-3 pb-5 pt-2">
        {navGroups
          .filter((group) => {
            if (userHierarchyLevel === "donvi") {
              return (
                group.name === "Đơn vị nhận quân" ||
                group.name === "Văn bản" ||
                group.name === "Báo cáo"
              );
            }
            if (["tinh", "xa"].includes(userHierarchyLevel)) {
              return group.name !== "Đơn vị nhận quân";
            }
            return true;
          })
          .map((group) => {
            if (
              userHierarchyLevel === "donvi" &&
              group.name === "Văn bản"
            ) {
              return {
                ...group,
                items: group.items.filter(
                  (item) => item.label === "Công văn đến / đi",
                ),
              };
            }
            return group;
          })
          .map((group) => {
            const isExpanded = expandedGroups[group.name];

            return (
              <div key={group.name} className="space-y-1">
                {!collapsed && (
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-[10px] px-3 py-1.5"
                    onClick={() => toggleGroup(group.name)}
                  >
                    <span className="text-[15px] font-medium text-[#9ca3af]">
                      {group.name}
                    </span>
                    <span className="text-[#c0c4cc]">
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                  </button>
                )}

                <div
                  className={clsx(
                    "space-y-0.5 overflow-hidden transition-all duration-300",
                    isExpanded || collapsed
                      ? "max-h-[600px] opacity-100"
                      : "max-h-0 opacity-0",
                  )}
                >
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/admin" && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={clsx(
                          "flex min-h-[44px] items-center gap-3 rounded-[12px] px-3.5 text-[14px] font-medium transition-colors duration-150",
                          isActive
                            ? "bg-[#e8f2ff] text-[#007aff]"
                            : "text-[#374151] hover:bg-white/80",
                        )}
                      >
                        <span className="shrink-0 text-[22px] leading-none">
                          {item.icon}
                        </span>
                        {!collapsed && (
                          <span className="truncate leading-snug">{item.label}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </nav>

      {!collapsed && (
        <div className="px-4 pb-5">
          <div
            className="rounded-[16px] px-4 py-3"
            style={{ background: "#ffffff" }}
          >
            <p className="text-[13px] font-semibold text-[#6b7280]">YMSA v1.0.0</p>
            <p className="mt-0.5 text-[12px] text-[#9ca3af]">© 2026 Ban Chỉ huy Quân sự</p>
          </div>
        </div>
      )}
    </aside>
  );
}
