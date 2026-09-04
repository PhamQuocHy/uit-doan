"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bell, Home, User, LogOut, Menu, Search, AlertTriangle, Target } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

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
};

export default function Topbar({
  title,
  onMenuToggle,
  userName,
  userRole,
  onLogout,
}: TopbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notiOpen, setNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState<Noti[]>([]);
  const [unread, setUnread] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notiRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.data || []);
      setUnread(data.unread || 0);
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
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllRead = async () => {
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    await loadNotifications();
  };

  const markOne = async (id: string) => {
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadNotifications();
  };

  return (
    <header
      className="sticky top-0 z-30 flex h-[64px] items-center justify-between bg-m3-background px-6"
    >
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
        <div
          className="mr-1 hidden min-w-[200px] items-center gap-2.5 rounded-full bg-m3-surface-low px-4 py-2.5 sm:flex"
        >
          <Search size={17} style={{ color: "var(--m3-outline)" }} />
          <span className="text-[14px]" style={{ color: "var(--m3-outline)" }}>
            Tìm kiếm...
          </span>
        </div>

        <div className="relative" ref={notiRef}>
          <button
            type="button"
            onClick={() => {
              setNotiOpen((v) => !v);
              setIsDropdownOpen(false);
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
            <div
              className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,360px)] overflow-hidden rounded-[28px] macos-glass shadow-[0_16px_48px_rgba(0,0,0,0.14)]"
            >
              <div className="flex items-center justify-between border-b border-m3-outline-variant/40 px-4 py-3">
                <p className="text-[15px] font-bold text-m3-on-surface">Thông báo</p>
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
                  <p className="px-4 py-8 text-center text-[14px]" style={{ color: "var(--m3-outline)" }}>
                    Chưa có thông báo
                  </p>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markOne(n.id)}
                      className={`flex w-full gap-3 border-b border-m3-outline-variant/30 px-4 py-3 text-left transition hover:bg-m3-on-surface/8 ${
                        n.read ? "opacity-70" : "bg-m3-primary-container/40"
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          n.type === "quota_shortage"
                            ? "bg-m3-warning-container text-m3-on-warning-container"
                            : "bg-m3-primary-container text-m3-on-primary-container"
                        }`}
                      >
                        {n.type === "quota_shortage" ? (
                          <AlertTriangle size={16} />
                        ) : (
                          <Target size={16} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-m3-on-surface">
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-[13px] leading-snug text-m3-on-surface-variant">
                          {n.message}
                        </p>
                        <p className="mt-1 text-[11px]" style={{ color: "var(--m3-outline)" }}>
                          {new Date(n.createdAt).toLocaleString("vi-VN")}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="border-t border-m3-outline-variant/40 px-4 py-2.5">
                <Link
                  href="/admin/quota"
                  onClick={() => setNotiOpen(false)}
                  className="text-[13px] font-semibold text-m3-primary"
                >
                  Xem giao chỉ tiêu →
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
            <div
              className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-[28px] py-2 macos-glass shadow-[0_16px_48px_rgba(0,0,0,0.14)]"
            >
              <div className="space-y-1 px-2 py-1">
                <Link
                  href="/admin"
                  className="flex min-h-[48px] items-center gap-3 rounded-full px-3.5 text-[15px] font-semibold text-m3-on-surface hover:bg-m3-on-surface/8"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <Home size={20} style={{ color: "var(--m3-on-surface-variant)" }} />
                  Về trang chủ
                </Link>
                <Link
                  href="/admin/profile"
                  className="flex min-h-[48px] items-center gap-3 rounded-full px-3.5 text-[15px] font-semibold text-m3-on-surface hover:bg-m3-on-surface/8"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <User size={20} style={{ color: "var(--m3-on-surface-variant)" }} />
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
