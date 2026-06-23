"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ChevronUp,
  ChevronDown,
  GraduationCap,
  HeartPulse,
  CalendarClock,
  BarChart3,
  Mic,
  UserCog,
  ShieldCheck,
  History,
  MapPin,
  ScanFace,
  Target,
  CheckSquare,
  Shield,
  Dumbbell,
  FileText,
  Archive,
  Settings,
  ClipboardList,
} from "lucide-react";
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

const navGroups: NavGroup[] = [
  {
    name: "Hồ sơ Thanh niên",
    items: [
      {
        href: "/admin",
        label: "Tổng quan",
        icon: <LayoutDashboard size={18} />,
      },
      {
        href: "/admin/citizens",
        label: "Quản lý Công dân",
        icon: <Users size={18} />,
      },
      {
        href: "/admin/education",
        label: "Học vấn & Việc làm",
        icon: <GraduationCap size={18} />,
      },
      {
        href: "/admin/health",
        label: "Hồ sơ Sức khỏe",
        icon: <HeartPulse size={18} />,
      },
      {
        href: "/admin/residence",
        label: "Biến động Cư trú",
        icon: <MapPin size={18} />,
      },
    ],
  },
  {
    name: "Nhận dạng AI",
    items: [
      {
        href: "/admin/ai-voice",
        label: "Nhận dạng CCCD (Voice)",
        icon: <Mic size={18} />,
      },
      {
        href: "/admin/ai-face",
        label: "Nhận dạng Khuôn mặt",
        icon: <ScanFace size={18} />,
      },
    ],
  },
  {
    name: "Công tác Tuyển quân",
    items: [
      {
        href: "/admin/recruitment",
        label: "Đợt khám tuyển",
        icon: <CalendarClock size={18} />,
      },
      {
        href: "/admin/quota",
        label: "Giao chỉ tiêu",
        icon: <Target size={18} />,
      },
      {
        href: "/admin/approval",
        label: "Xét duyệt danh sách",
        icon: <CheckSquare size={18} />,
      },
    ],
  },
  {
    name: "Quản lý Huấn luyện",
    items: [
      {
        href: "/admin/training",
        label: "Huấn luyện & Diễn tập",
        icon: <Dumbbell size={18} />,
      },
    ],
  },
  {
    name: "Đơn vị nhận quân",
    items: [
      {
        href: "/admin/receiving",
        label: "Nhận danh sách quân",
        icon: <ClipboardList size={18} />,
      },
    ],
  },
  {
    name: "Hệ thống Văn bản",
    items: [
      {
        href: "/admin/documents",
        label: "Công văn đến/đi",
        icon: <FileText size={18} />,
      },
      {
        href: "/admin/document-archive",
        label: "Kho văn bản",
        icon: <Archive size={18} />,
      },
    ],
  },
  {
    name: "Báo cáo & Thống kê",
    items: [
      {
        href: "/admin/reports",
        label: "Báo cáo & Thống kê",
        icon: <BarChart3 size={18} />,
      },
    ],
  },
  {
    name: "Quản trị hệ thống",
    items: [
      {
        href: "/admin/users",
        label: "Quản lý Thành viên",
        icon: <UserCog size={18} />,
      },
      {
        href: "/admin/roles",
        label: "Vai trò & Quyền hạn",
        icon: <ShieldCheck size={18} />,
      },
      {
        href: "/admin/logs",
        label: "Nhật ký hệ thống",
        icon: <History size={18} />,
      },
      {
        href: "/admin/settings",
        label: "Cài đặt hệ thống",
        icon: <Settings size={18} />,
      },
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
  onToggle,
  onLogout,
  userName,
  userRole,
  userHierarchyLevel,
}: SidebarProps) {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {
      "Hồ sơ Thanh niên": true,
      "Nhận dạng AI": true,
      "Công tác Tuyển quân": true,
      "Quản lý Dân quân": true,
      "Hệ thống Văn bản": true,
      "Báo cáo & Thống kê": true,
      "Quản trị hệ thống": true,
    },
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
        "fixed left-0 top-0 h-screen flex flex-col z-40 transition-all duration-300",
        collapsed ? "w-16" : "w-72",
      )}
      style={{
        background: "#ffffff",
        borderRight: "1px solid #edf4dc",
        boxShadow: "4px 0 20px rgba(0,0,0,0.02)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center h-16 px-4 shrink-0"
        style={{ borderBottom: "1px solid #edf4dc" }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
            <img
              src="/images/logo_qd.png"
              alt="Logo"
              style={{ width: "50px", height: "50px", objectFit: "contain" }}
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p
                className="text-xs uppercase font-medium leading-[1.6]"
                style={{ color: "#93a83e", fontSize: "14.3px" }}
              >
                Hệ thống quản lý <br></br>Dữ liệu Nghĩa vụ Quân Sự
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2.5 space-y-4 overflow-y-auto custom-scrollbar">
        {navGroups
          .filter((group) => {
            if (userHierarchyLevel === "donvi") {
              return (
                group.name === "Đơn vị nhận quân" ||
                group.name === "Hệ thống Văn bản" ||
                group.name === "Báo cáo & Thống kê"
              );
            }
            if (["tinh", "huyen", "xa"].includes(userHierarchyLevel)) {
              return group.name !== "Đơn vị nhận quân";
            }
            return true;
          })
          .map((group) => {
            if (
              userHierarchyLevel === "donvi" &&
              group.name === "Hệ thống Văn bản"
            ) {
              return {
                ...group,
                items: group.items.filter(
                  (item) => item.label === "Công văn đến/đi",
                ),
              };
            }
            return group;
          })
          .map((group, groupIndex) => {
            const isExpanded = expandedGroups[group.name];

            return (
              <div key={groupIndex} className="space-y-1">
                {!collapsed && (
                  <div
                    className="px-3 pb-1 pt-2 flex items-center justify-between cursor-pointer group"
                    onClick={() => toggleGroup(group.name)}
                  >
                    <span className="text-lg font-base text-gray-800 opacity-80 group-hover:opacity-100 transition-opacity">
                      {group.name}
                    </span>
                    <span className="text-gray-900 opacity-80 group-hover:opacity-100 transition-opacity">
                      {isExpanded ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </span>
                  </div>
                )}

                <div
                  className={clsx(
                    "overflow-hidden transition-all duration-300 space-y-1",
                    isExpanded || collapsed
                      ? "max-h-[500px] opacity-100"
                      : "max-h-0 opacity-0",
                  )}
                >
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/admin" &&
                        pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={clsx(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[16px] font-base transition-all duration-150",
                        )}
                        style={
                          isActive
                            ? {
                                background: "#f8fae8",
                                color: "#707781",
                                border: "1px solid #edf4dc",
                              }
                            : {
                                color: "#707781",
                                border: "1px solid transparent",
                              }
                        }
                        title={collapsed ? item.label : undefined}
                      >
                        <span className="shrink-0">{item.icon}</span>
                        {!collapsed && (
                          <span className="truncate tracking-wide">
                            {item.label}
                          </span>
                        )}
                        {isActive && !collapsed && (
                          <span
                            className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: "#748c2c" }}
                          />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </nav>

      {/* User + Logout (Removed) */}
      <div className="px-5 pb-5 mt-auto">
        {/* Footer Info */}
        {!collapsed && (
          <div className="mt-6 pt-4 border-t border-[#edf4dc] px-2">
            <p className="text-[13px] font-medium text-[#707781]">
              Version 1.0.0
            </p>
            <p className="text-[13px] font-medium text-[#707781] mt-0.5">
              © 2026 Ban Chỉ huy Quân sự
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
