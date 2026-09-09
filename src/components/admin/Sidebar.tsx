"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronUp, ChevronDown } from "lucide-react";
import {
  FcHome,
  FcConferenceCall,
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
  FcDataSheet,
  FcLike,
} from "react-icons/fc";
import { clsx } from "clsx";
import type { FunctionalRole } from "@/lib/functional-roles";

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
      { href: "/admin/health", label: "Khám sức khỏe", icon: <FcLike size={ICON} /> },
      { href: "/admin/citizen-archive", label: "Hồ sơ lưu trữ", icon: <FcDataSheet size={ICON} /> },
    ],
  },
  {
    name: "Nhận dạng AI",
    items: [
      {
        href: "/admin/ai-face",
        label: "Nhận diện khuôn mặt và giọng nói",
        icon: <FcCameraIdentification size={ICON} />,
      },
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
  userFunctionalRole: string;
  userUnitCode?: string;
}

function filterNavGroups(
  hierarchyLevel: string,
  functionalRole: FunctionalRole,
  unitCode = "",
): NavGroup[] {
  const isQk =
    hierarchyLevel === "donvi" && /^(dv-qk\d+|dv-btl-hn)$/.test(unitCode);

  if (functionalRole === "nhan_quan") {
    if (!isQk) {
      return [
        {
          name: "Đơn vị nhận quân",
          items: [
            {
              href: "/admin/receiving",
              label: "Quân số & xác nhận nhận",
              icon: <FcTodoList size={ICON} />,
            },
          ],
        },
      ];
    }

    return navGroups
      .filter((g) =>
        ["Tuyển quân", "Đơn vị nhận quân", "Văn bản", "Báo cáo"].includes(g.name),
      )
      .map((g) => {
        if (g.name === "Văn bản") {
          return {
            ...g,
            items: g.items.filter((i) => i.label === "Công văn đến / đi"),
          };
        }
        if (g.name === "Tuyển quân") {
          return {
            ...g,
            items: g.items.filter(
              (i) =>
                i.href === "/admin/approval" || i.href === "/admin/quota",
            ),
          };
        }
        if (g.name === "Đơn vị nhận quân") {
          return {
            ...g,
            items: g.items.map((item) =>
              item.href === "/admin/receiving"
                ? { ...item, label: "Chỉ tiêu ĐV nhận · Phân quân · Chốt" }
                : item,
            ),
          };
        }
        return g;
      });
  }

  if (functionalRole === "y_te") {
    return [
      {
        name: "Khám sức khỏe",
        items: [
          {
            href: "/admin/health",
            label: "Khám sức khỏe",
            icon: <FcLike size={ICON} />,
          },
        ],
      },
    ];
  }

  // tuyen_quan — theo cấp đơn vị hành chính / quân khu
  return navGroups
    .filter((group) => {
      if (hierarchyLevel === "donvi") {
        return (
          group.name === "Tuyển quân" ||
          group.name === "Đơn vị nhận quân" ||
          group.name === "Văn bản" ||
          group.name === "Báo cáo"
        );
      }
      return true;
    })
    .map((group) => {
      if (hierarchyLevel === "donvi" && group.name === "Văn bản") {
        return {
          ...group,
          items: group.items.filter(
            (item) => item.label === "Công văn đến / đi",
          ),
        };
      }
      if (hierarchyLevel === "donvi" && group.name === "Tuyển quân") {
        return {
          ...group,
          items: group.items.filter((i) =>
            isQk
              ? i.href === "/admin/approval" || i.href === "/admin/quota"
              : i.href === "/admin/approval",
          ),
        };
      }
      if (
        (hierarchyLevel === "tinh" || hierarchyLevel === "xa") &&
        group.name === "Đơn vị nhận quân"
      ) {
        return {
          ...group,
          name: "Nhận quân",
          items: group.items.map((item) =>
            item.href === "/admin/receiving"
              ? { ...item, label: "Vị trí nhận quân công dân" }
              : item,
          ),
        };
      }
      if (hierarchyLevel === "bo" && group.name === "Đơn vị nhận quân") {
        return {
          ...group,
          name: "Nhận quân",
          items: group.items.map((item) =>
            item.href === "/admin/receiving"
              ? { ...item, label: "Chỉ tiêu QK · Duyệt & công bố" }
              : item,
          ),
        };
      }
      if (hierarchyLevel === "donvi" && group.name === "Đơn vị nhận quân") {
        return {
          ...group,
          items: group.items.map((item) =>
            item.href === "/admin/receiving"
              ? {
                  ...item,
                  label: isQk
                    ? "Chỉ tiêu ĐV nhận · Phân quân · Chốt"
                    : "Quân số & xác nhận nhận",
                }
              : item,
          ),
        };
      }
      return group;
    });
}

export default function Sidebar({
  collapsed,
  userHierarchyLevel,
  userFunctionalRole,
  userUnitCode = "",
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

  const visibleGroups = filterNavGroups(
    userHierarchyLevel,
    (userFunctionalRole || "tuyen_quan") as FunctionalRole,
    userUnitCode,
  );

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 z-40 flex h-screen flex-col bg-m3-surface-low text-m3-on-surface transition-all duration-300",
        collapsed ? "w-[84px]" : "w-[300px]",
      )}
    >
      <div className="flex h-[64px] shrink-0 items-center gap-3 px-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[14px]"
          style={{ background: "var(--m3-primary-container)" }}
        >
          <img
            src="/images/logo_qd.png"
            alt="Logo"
            className="h-6 w-6 object-contain"
          />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-[17px] font-bold tracking-tight text-m3-on-surface">
              YMSA
            </p>
            <p className="truncate text-[12px] font-medium text-m3-on-surface-variant">
              Nghĩa vụ quân sự
            </p>
          </div>
        )}
      </div>

      <nav className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-3 pb-5 pt-2">
        {visibleGroups
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
                    <span className="text-[16px] font-semibold text-m3-outline">
                      {group.name}
                    </span>
                    <span style={{ color: "var(--m3-outline)" }}>
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
                      (item.href !== "/admin" &&
                        item.href !== "/admin/citizens" &&
                        pathname.startsWith(item.href)) ||
                      (item.href === "/admin/citizens" &&
                        (pathname === "/admin/citizens" ||
                          pathname.startsWith("/admin/citizens/")));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={clsx(
                          "flex min-h-[44px] items-center gap-3 rounded-full px-3.5 text-[14px] font-semibold transition-[background-color,color] duration-200 ease-[cubic-bezier(0.34,0.8,0.34,1)]",
                          isActive
                            ? "bg-m3-secondary-container text-m3-on-secondary-container"
                            : "text-m3-on-surface-variant hover:bg-m3-on-surface/8",
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
            className="rounded-[20px] px-4 py-3 bg-m3-surface-lowest"
          >
            <p className="text-[13px] font-semibold text-m3-on-surface-variant">YMSA v1.0.0</p>
            <p className="mt-0.5 text-[12px] text-m3-outline">© 2026 Ban Chỉ huy Quân sự</p>
          </div>
        </div>
      )}
    </aside>
  );
}
