"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Home, User, LogOut, Menu } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { clsx } from "clsx";

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
      className="h-16 flex items-center justify-between px-6 sticky top-0 z-30"
      style={{
        background: "#ffffff",
        borderBottom: "1px solid #edf4dc",
        boxShadow: "0 1px 0 rgba(116,140,44,0.05)",
      }}
    >
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-50 transition-colors"
            style={{ color: "#748c2c" }}
          >
            <Menu size={20} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          className="relative p-2 rounded-xl transition-colors hover:bg-gray-50"
          style={{ color: "#606873" }}
        >
          <Bell size={20} />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: "#ff0000" }}
          />
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 pl-3 ml-1 cursor-pointer transition-colors hover:bg-gray-50/50 p-1 rounded-xl"
            style={{ borderLeft: "1px solid #edf4dc" }}
          >
            {/* Google-style colored ring wrapper */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 p-[2px]"
              style={{
                background:
                  "conic-gradient(#ea4335 0deg 90deg, #4285f4 90deg 180deg, #34a853 180deg 270deg, #fbbc05 270deg 360deg)",
              }}
            >
              {/* White border gap */}
              <div className="w-full h-full bg-white rounded-full flex items-center justify-center p-0.5 relative overflow-hidden">
                <Image
                  src="/images/admin.png"
                  alt="User Avatar"
                  fill
                  className="object-cover p-1"
                />
              </div>
            </div>
          </button>

          {/* User Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
              {/* User Info Header (Mobile) */}
              <div className="px-4 py-3 border-b border-gray-100 sm:hidden">
                <p className="text-[20px] font-base text-gray-900 truncate">
                  {userName}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {userRole === "admin" ? "Quản trị viên" : "Người dùng"}
                </p>
              </div>

              <div className="px-2 py-1 space-y-1">
                <Link
                  href="/admin"
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <Home size={18} className="text-gray-400" />
                  Về trang chủ
                </Link>
                <Link
                  href="/admin/profile"
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <User size={18} className="text-gray-400" />
                  Thông tin tài khoản
                </Link>
              </div>

              <div className="px-2 pt-1 mt-1 border-t border-gray-100">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onLogout?.();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <LogOut size={18} />
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
