"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Home, User, LogOut, Menu, Search } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface TopbarProps {
  title: string;
  onMenuToggle?: () => void;
  userName: string;
  userRole?: string;
  onLogout?: () => void;
}

export default function Topbar({
  title,
  onMenuToggle,
  userName,
  userRole,
  onLogout,
}: TopbarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

        <button
          className="relative rounded-[12px] p-2.5 text-[#374151] transition-colors hover:bg-[#f8fafb]"
          aria-label="Thông báo"
        >
          <Bell size={22} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ff3b30]" />
        </button>

        <div className="relative ml-1" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
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
