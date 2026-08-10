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
      className="sticky top-0 z-30 flex h-[64px] items-center justify-between px-6"
      style={{ background: "#f8fafb" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="rounded-[12px] p-2.5 text-[#374151] transition-colors hover:bg-[#f8fafb]"
            aria-label="Mở / đóng menu"
          >
            <Menu size={22} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[18px] font-bold tracking-tight text-[#1f2937]">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="mr-1 hidden min-w-[200px] items-center gap-2.5 rounded-[12px] px-4 py-2.5 sm:flex"
          style={{ background: "#ffffff" }}
        >
          <Search size={17} className="text-[#9ca3af]" />
          <span className="text-[14px] text-[#9ca3af]">Tìm kiếm...</span>
        </div>

        <div className="relative" ref={notiRef}>
          <button
            type="button"
            onClick={() => {
              setNotiOpen((v) => !v);
              setIsDropdownOpen(false);
              if (!notiOpen) loadNotifications();
            }}
            className="relative rounded-[12px] p-2.5 text-[#374151] transition-colors hover:bg-[#f8fafb]"
            aria-label="Thông báo"
          >
            <Bell size={22} />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {notiOpen && (
            <div
              className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,360px)] overflow-hidden rounded-[18px]"
              style={{
                background: "rgba(255,255,255,0.96)",
                backdropFilter: "blur(22px)",
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 16px 48px rgba(0,0,0,0.14)",
              }}
            >
              <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
                <p className="text-[15px] font-bold text-[#1d1d1f]">Thông báo</p>
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-[12px] font-semibold text-[#007aff]"
                  >
                    Đánh dấu đã đọc
                  </button>
                )}
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[14px] text-[#8e8e93]">
                    Chưa có thông báo
                  </p>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markOne(n.id)}
                      className={`flex w-full gap-3 border-b border-black/[0.04] px-4 py-3 text-left transition hover:bg-[#f5f5f7] ${
                        n.read ? "opacity-70" : "bg-[rgba(0,122,255,0.04)]"
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          n.type === "quota_shortage"
                            ? "bg-[rgba(255,149,0,0.15)] text-[#c93400]"
                            : "bg-[rgba(0,122,255,0.12)] text-[#007aff]"
                        }`}
                      >
                        {n.type === "quota_shortage" ? (
                          <AlertTriangle size={16} />
                        ) : (
                          <Target size={16} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#1d1d1f]">
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-[13px] leading-snug text-[#6e6e73]">
                          {n.message}
                        </p>
                        <p className="mt-1 text-[11px] text-[#8e8e93]">
                          {new Date(n.createdAt).toLocaleString("vi-VN")}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="border-t border-black/[0.06] px-4 py-2.5">
                <Link
                  href="/admin/quota"
                  onClick={() => setNotiOpen(false)}
                  className="text-[13px] font-semibold text-[#007aff]"
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
            className="flex items-center gap-2.5 rounded-[12px] p-1.5 pr-3 transition-colors hover:bg-[#f8fafb]"
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
              <p className="max-w-[160px] truncate text-[14px] font-bold text-[#1f2937]">
                {userName}
              </p>
              <p className="text-[12px] font-medium text-[#6b7280]">
                {userRole === "admin" ? "Quản trị viên" : "Người dùng"}
              </p>
            </div>
          </button>

          {isDropdownOpen && (
            <div
              className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-[18px] py-2"
              style={{
                background: "rgba(255,255,255,0.94)",
                backdropFilter: "blur(22px)",
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 16px 48px rgba(0,0,0,0.14)",
              }}
            >
              <div className="space-y-1 px-2 py-1">
                <Link
                  href="/admin"
                  className="flex min-h-[48px] items-center gap-3 rounded-[12px] px-3.5 text-[15px] font-semibold text-[#1d1d1f] hover:bg-black/[0.04]"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <Home size={20} className="text-[#6e6e73]" />
                  Về trang chủ
                </Link>
                <Link
                  href="/admin/profile"
                  className="flex min-h-[48px] items-center gap-3 rounded-[12px] px-3.5 text-[15px] font-semibold text-[#1d1d1f] hover:bg-black/[0.04]"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <User size={20} className="text-[#6e6e73]" />
                  Thông tin tài khoản
                </Link>
              </div>
              <div className="mx-3 my-1.5 border-t border-black/[0.06]" />
              <div className="px-2 pb-1">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onLogout?.();
                  }}
                  className="flex min-h-[48px] w-full items-center gap-3 rounded-[12px] px-3.5 text-[15px] font-semibold text-[#ff3b30] hover:bg-red-50"
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
