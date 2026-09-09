"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  FormEvent,
  KeyboardEvent,
} from "react";
import {
  Bell,
  Home,
  User,
  LogOut,
  Menu,
  Search,
  AlertTriangle,
  Target,
  ClipboardCheck,
  Archive,
  FileText,
  Send,
  UserCheck,
  UserX,
  CornerDownLeft,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface TopbarProps {
  title: string;
  onMenuToggle?: () => void;
  userName: string;
  userRole?: string;
  onLogout?: () => void;
}

type Noti = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
  href?: string;
};

type FeatureItem = {
  href: string;
  label: string;
  group: string;
  keywords: string[];
};

/** Danh mục chức năng hệ thống — ô tìm kiếm topbar chỉ tìm các mục này. */
const SYSTEM_FEATURES: FeatureItem[] = [
  {
    href: "/admin",
    label: "Tổng quan",
    group: "Hồ sơ thanh niên",
    keywords: ["dashboard", "trang chủ"],
  },
  {
    href: "/admin/citizens",
    label: "Hồ sơ công dân",
    group: "Hồ sơ thanh niên",
    keywords: ["công dân", "thanh niên", "hồ sơ"],
  },
  {
    href: "/admin/health",
    label: "Khám sức khỏe",
    group: "Hồ sơ thanh niên",
    keywords: ["sức khỏe", "khám"],
  },
  {
    href: "/admin/citizen-archive",
    label: "Hồ sơ lưu trữ",
    group: "Hồ sơ thanh niên",
    keywords: ["lưu trữ", "archive"],
  },
  {
    href: "/admin/ai-face",
    label: "Nhận diện khuôn mặt và giọng nói",
    group: "Nhận dạng AI",
    keywords: ["ai", "khuôn mặt", "giọng nói", "nfc"],
  },
  {
    href: "/admin/recruitment",
    label: "Đợt khám tuyển",
    group: "Tuyển quân",
    keywords: ["đợt", "khám tuyển", "tuyển quân"],
  },
  {
    href: "/admin/quota",
    label: "Giao chỉ tiêu",
    group: "Tuyển quân",
    keywords: ["chỉ tiêu", "quota"],
  },
  {
    href: "/admin/approval",
    label: "Xét duyệt danh sách",
    group: "Tuyển quân",
    keywords: ["xét duyệt", "duyệt gọi", "nhập ngũ"],
  },
  {
    href: "/admin/training",
    label: "Huấn luyện & diễn tập",
    group: "Huấn luyện",
    keywords: ["huấn luyện", "diễn tập"],
  },
  {
    href: "/admin/receiving",
    label: "Sắp xếp / nhận quân",
    group: "Đơn vị nhận quân",
    keywords: ["nhận quân", "danh sách quân", "phân quân", "sắp xếp đơn vị", "chưa phân quân"],
  },
  {
    href: "/admin/documents",
    label: "Công văn đến / đi",
    group: "Văn bản",
    keywords: ["công văn", "công văn đến", "công văn đi", "văn bản", "cong van"],
  },
  {
    href: "/admin/document-archive",
    label: "Kho văn bản",
    group: "Văn bản",
    keywords: ["kho văn bản", "luật", "thông tư"],
  },
  {
    href: "/admin/reports",
    label: "Báo cáo & thống kê",
    group: "Báo cáo",
    keywords: ["báo cáo", "thống kê"],
  },
  {
    href: "/admin/users",
    label: "Thành viên",
    group: "Quản trị",
    keywords: ["user", "thành viên", "tài khoản"],
  },
  {
    href: "/admin/roles",
    label: "Vai trò & quyền",
    group: "Quản trị",
    keywords: ["vai trò", "quyền"],
  },
  {
    href: "/admin/logs",
    label: "Nhật ký hệ thống",
    group: "Quản trị",
    keywords: ["nhật ký", "log"],
  },
  {
    href: "/admin/settings",
    label: "Cài đặt",
    group: "Quản trị",
    keywords: ["cài đặt", "settings"],
  },
  {
    href: "/admin/profile",
    label: "Thông tin tài khoản",
    group: "Tài khoản",
    keywords: ["profile", "hồ sơ cá nhân"],
  },
];

function normalizeVn(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d");
}

function searchFeatures(query: string): FeatureItem[] {
  const q = query.trim();
  if (!q) return [];
  const nq = normalizeVn(q);
  const scored = SYSTEM_FEATURES.map((f) => {
    const hay = normalizeVn([f.label, f.group, ...f.keywords].join(" "));
    let score = 0;
    if (normalizeVn(f.label).includes(nq)) score += 30;
    if (normalizeVn(f.group).includes(nq)) score += 12;
    if (
      f.keywords.some(
        (k) => normalizeVn(k).includes(nq) || nq.includes(normalizeVn(k)),
      )
    ) {
      score += 20;
    }
    if (hay.includes(nq)) score += 8;
    return { f, score };
  }).filter((x) => x.score > 0);
  scored.sort(
    (a, b) => b.score - a.score || a.f.label.localeCompare(b.f.label, "vi"),
  );
  return scored.slice(0, 8).map((x) => x.f);
}

const DISMISSED_SYS_KEY = "ymsa.dismissedSysNotis";

function readDismissedSys(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_SYS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeDismissedSys(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_SYS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export default function Topbar({
  title,
  onMenuToggle,
  userName,
  userRole,
  onLogout,
}: TopbarProps) {
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notiOpen, setNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState<Noti[]>([]);
  const [unread, setUnread] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notiRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const featureResults = useMemo(
    () => searchFeatures(searchQuery),
    [searchQuery],
  );

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) return;
      const data = await res.json();
      const dismissed = readDismissedSys();
      const list: Noti[] = (data.data || []).map((n: Noti) =>
        n.id.startsWith("sys-") && dismissed.has(n.id)
          ? { ...n, read: true }
          : n,
      );
      setNotifications(list);
      setUnread(list.filter((n) => !n.read).length);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const t = window.setInterval(loadNotifications, 15000);
    return () => window.clearInterval(t);
  }, [loadNotifications]);

  useEffect(() => {
    setActiveIdx(0);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setNotiOpen(false);
      }
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const goFeature = (href: string) => {
    setSearchQuery("");
    setSearchOpen(false);
    router.push(href);
  };

  const submitSearch = (e?: FormEvent) => {
    e?.preventDefault();
    const first = featureResults[activeIdx] || featureResults[0];
    if (first) goFeature(first.href);
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!searchOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      setSearchOpen(true);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) =>
        featureResults.length ? (i + 1) % featureResults.length : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) =>
        featureResults.length
          ? (i - 1 + featureResults.length) % featureResults.length
          : 0,
      );
    } else if (e.key === "Escape") {
      setSearchOpen(false);
    }
  };

  const markAllRead = async () => {
    const dismissed = readDismissedSys();
    notifications.forEach((n) => {
      if (n.id.startsWith("sys-")) dismissed.add(n.id);
    });
    writeDismissedSys(dismissed);
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    await loadNotifications();
  };

  const openNoti = async (n: Noti) => {
    if (n.id.startsWith("sys-")) {
      const dismissed = readDismissedSys();
      dismissed.add(n.id);
      writeDismissedSys(dismissed);
    } else {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      });
    }
    setNotiOpen(false);
    if (n.href) router.push(n.href);
    await loadNotifications();
  };

  const notiIcon = (type: string) => {
    if (type === "quota_shortage") return <AlertTriangle size={16} />;
    if (type === "approval_pending") return <ClipboardCheck size={16} />;
    if (type === "archive_pending") return <Archive size={16} />;
    if (type === "document_incoming") return <FileText size={16} />;
    if (type === "document_outgoing") return <Send size={16} />;
    if (type === "citizen_approved") return <UserCheck size={16} />;
    if (type === "citizen_rejected") return <UserX size={16} />;
    return <Target size={16} />;
  };

  return (
    <header className="sticky top-0 z-30 flex h-[64px] items-center justify-between bg-m3-background px-6">
      <div className="flex min-w-0 items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="rounded-full p-2.5 text-m3-on-surface-variant transition-colors hover:bg-m3-on-surface/8"
            aria-label="Mở / đóng menu"
          >
            <Menu size={22} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[18px] font-bold tracking-tight text-m3-on-surface">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative mr-1 hidden sm:block" ref={searchRef}>
          <form
            onSubmit={submitSearch}
            className="flex min-w-[240px] items-center gap-2.5 rounded-full bg-m3-surface-low px-4 py-2"
          >
            <button
              type="submit"
              className="shrink-0 text-m3-on-surface-variant hover:text-m3-primary"
              aria-label="Tìm chức năng"
            >
              <Search size={17} />
            </button>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={onSearchKeyDown}
              placeholder="Tìm chức năng..."
              className="w-full min-w-0 bg-transparent text-[14px] text-m3-on-surface outline-none placeholder:text-m3-outline"
              autoComplete="off"
            />
          </form>

          {searchOpen && searchQuery.trim() && (
            <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,360px)] overflow-hidden rounded-[20px] border border-m3-outline-variant/40 bg-m3-surface-lowest shadow-[0_16px_48px_rgba(0,0,0,0.14)]">
              {featureResults.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-m3-on-surface-variant">
                  Không tìm thấy chức năng “{searchQuery.trim()}”
                </p>
              ) : (
                <ul className="max-h-[320px] overflow-y-auto py-1">
                  {featureResults.map((item, idx) => (
                    <li key={item.href}>
                      <button
                        type="button"
                        onClick={() => goFeature(item.href)}
                        onMouseEnter={() => setActiveIdx(idx)}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${
                          idx === activeIdx
                            ? "bg-m3-primary-container/50"
                            : "hover:bg-m3-on-surface/5"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block text-[14px] font-semibold text-m3-on-surface">
                            {item.label}
                          </span>
                          <span className="block text-[12px] text-m3-on-surface-variant">
                            {item.group}
                          </span>
                        </span>
                        {idx === activeIdx && (
                          <CornerDownLeft
                            size={14}
                            className="shrink-0 text-m3-on-surface-variant"
                          />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={notiRef}>
          <button
            type="button"
            onClick={() => {
              setNotiOpen((v) => !v);
              setIsDropdownOpen(false);
              setSearchOpen(false);
              if (!notiOpen) loadNotifications();
            }}
            className="relative rounded-full p-2.5 text-m3-on-surface-variant transition-colors hover:bg-m3-on-surface/8"
            aria-label="Thông báo"
          >
            <Bell size={22} />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-m3-error px-1 text-[10px] font-bold text-m3-on-error">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {notiOpen && (
            <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,360px)] overflow-hidden rounded-[28px] macos-glass shadow-[0_16px_48px_rgba(0,0,0,0.14)]">
              <div className="flex items-center justify-between border-b border-m3-outline-variant/40 px-4 py-3">
                <p className="text-[15px] font-bold text-m3-on-surface">
                  Thông báo
                </p>
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-[12px] font-semibold text-m3-primary"
                  >
                    Đánh dấu đã đọc
                  </button>
                )}
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <p
                    className="px-4 py-8 text-center text-[14px]"
                    style={{ color: "var(--m3-outline)" }}
                  >
                    Chưa có thông báo
                  </p>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => void openNoti(n)}
                      className={`flex w-full gap-3 border-b border-m3-outline-variant/30 px-4 py-3 text-left transition hover:bg-m3-on-surface/8 ${
                        n.read ? "opacity-70" : "bg-m3-primary-container/40"
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          n.type === "quota_shortage" ||
                          n.type === "archive_pending" ||
                          n.type === "citizen_rejected"
                            ? "bg-m3-warning-container text-m3-on-warning-container"
                            : n.type === "citizen_approved"
                              ? "bg-m3-success-container text-m3-on-success-container"
                              : "bg-m3-primary-container text-m3-on-primary-container"
                        }`}
                      >
                        {notiIcon(n.type)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-m3-on-surface">
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-[13px] leading-snug text-m3-on-surface-variant">
                          {n.message}
                        </p>
                        <p
                          className="mt-1 text-[11px]"
                          style={{ color: "var(--m3-outline)" }}
                        >
                          {new Date(n.createdAt).toLocaleString("vi-VN")}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-m3-outline-variant/40 px-4 py-2.5">
                <Link
                  href="/admin/documents"
                  onClick={() => setNotiOpen(false)}
                  className="text-[13px] font-semibold text-m3-primary"
                >
                  Công văn →
                </Link>
                <Link
                  href="/admin/quota"
                  onClick={() => setNotiOpen(false)}
                  className="text-[13px] font-semibold text-m3-primary"
                >
                  Chỉ tiêu →
                </Link>
                <Link
                  href="/admin/approval"
                  onClick={() => setNotiOpen(false)}
                  className="text-[13px] font-semibold text-m3-primary"
                >
                  Xét duyệt →
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="relative ml-1" ref={dropdownRef}>
          <button
            onClick={() => {
              setIsDropdownOpen(!isDropdownOpen);
              setNotiOpen(false);
              setSearchOpen(false);
            }}
            className="flex items-center gap-2.5 rounded-full p-1.5 pr-3 transition-colors hover:bg-m3-on-surface/8"
          >
            <div className="relative h-9 w-9 overflow-hidden rounded-full">
              <Image
                src="/images/admin.png"
                alt="User Avatar"
                fill
                className="object-cover"
              />
            </div>
            <div className="hidden text-left sm:block">
              <p className="max-w-[160px] truncate text-[14px] font-bold text-m3-on-surface">
                {userName}
              </p>
              <p className="text-[12px] font-medium text-m3-on-surface-variant">
                {userRole === "admin" ? "Quản trị viên" : "Người dùng"}
              </p>
            </div>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-[28px] py-2 macos-glass shadow-[0_16px_48px_rgba(0,0,0,0.14)]">
              <div className="space-y-1 px-2 py-1">
                <Link
                  href="/admin"
                  className="flex min-h-[48px] items-center gap-3 rounded-full px-3.5 text-[15px] font-semibold text-m3-on-surface hover:bg-m3-on-surface/8"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <Home
                    size={20}
                    style={{ color: "var(--m3-on-surface-variant)" }}
                  />
                  Về trang chủ
                </Link>
                <Link
                  href="/admin/profile"
                  className="flex min-h-[48px] items-center gap-3 rounded-full px-3.5 text-[15px] font-semibold text-m3-on-surface hover:bg-m3-on-surface/8"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <User
                    size={20}
                    style={{ color: "var(--m3-on-surface-variant)" }}
                  />
                  Thông tin tài khoản
                </Link>
              </div>
              <div className="mx-3 my-1.5 border-t border-m3-outline-variant/40" />
              <div className="px-2 pb-1">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onLogout?.();
                  }}
                  className="flex min-h-[48px] w-full items-center gap-3 rounded-full px-3.5 text-[15px] font-semibold text-m3-error hover:bg-m3-error/10"
                >
                  <LogOut size={20} />
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
