"use client";

import { History, Search, Filter } from "lucide-react";

export default function LogsPage() {
  const logs = [
    {
      id: 1,
      action: "Cập nhật hồ sơ công dân",
      target: "Nguyễn Văn Nam (079098...)",
      user: "bich.tt",
      time: "10 phút trước",
      type: "update",
    },
    {
      id: 2,
      action: "Thêm mới kết quả khám sức khỏe",
      target: "Trần Bình B",
      user: "nam.lh",
      time: "1 giờ trước",
      type: "create",
    },
    {
      id: 3,
      action: "Duyệt đơn xin tạm hoãn",
      target: "Lê Hoàng C",
      user: "admin",
      time: "Hôm qua",
      type: "approve",
    },
    {
      id: 4,
      action: "Khởi tạo đợt khám tuyển mới",
      target: "Đợt 1 năm 2026",
      user: "admin",
      time: "Hôm qua",
      type: "create",
    },
    {
      id: 5,
      action: "Đăng nhập hệ thống",
      target: "bich.tt",
      user: "bich.tt",
      time: "2 ngày trước",
      type: "system",
    },
    {
      id: 6,
      action: "Xóa tài khoản",
      target: "user03",
      user: "admin",
      time: "2 ngày trước",
      type: "delete",
    },
  ];

  const getTypeStyle = (type: string) => {
    switch (type) {
      case "create":
        return "bg-m3-success-container text-m3-on-success-container";
      case "update":
        return "bg-m3-primary-container text-m3-on-primary-container";
      case "delete":
        return "bg-m3-error-container text-m3-on-error-container";
      case "approve":
        return "bg-m3-secondary-container text-m3-on-secondary-container";
      default:
        return "bg-m3-surface-container text-m3-on-surface-variant";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "create":
        return "THÊM MỚI";
      case "update":
        return "CẬP NHẬT";
      case "delete":
        return "XÓA";
      case "approve":
        return "PHÊ DUYỆT";
      default:
        return "HỆ THỐNG";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
            Nhật ký Hệ thống (Logs)
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m3-primary, #1a73e8)" }}>
            Theo dõi mọi hoạt động, thay đổi dữ liệu của người dùng trên toàn hệ
            thống
          </p>
        </div>
      </div>

      <div className="bg-m3-surface-lowest rounded-2xl shadow-sm border border-m3-outline-variant overflow-hidden">
        <div className="p-4 border-b border-m3-outline-variant flex gap-4 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
              size={18}
            />
            <input
              type="text"
              placeholder="Tìm kiếm log theo hành động, user..."
              className="w-full pl-10 pr-4 py-2 border border-m3-outline-variant rounded-xl text-sm focus:outline-none focus:border-m3-primary transition-colors"
            />
          </div>
          <div className="relative">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
              size={18}
            />
            <select className="pl-10 pr-8 py-2 border border-m3-outline-variant rounded-xl text-sm appearance-none focus:outline-none focus:border-m3-primary transition-colors bg-m3-surface-lowest cursor-pointer">
              <option value="">Tất cả thao tác</option>
              <option value="create">Thêm mới</option>
              <option value="update">Cập nhật</option>
              <option value="delete">Xóa</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-m3-surface-high/50 text-m3-on-surface-variant font-medium border-b border-m3-outline-variant">
              <tr>
                <th className="px-6 py-4">Thời gian</th>
                <th className="px-6 py-4">Người thực hiện</th>
                <th className="px-6 py-4">Loại hình</th>
                <th className="px-6 py-4">Nội dung thao tác</th>
                <th className="px-6 py-4">Đối tượng tác động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-m3-outline-variant">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-m3-surface-high/50 transition-colors"
                >
                  <td className="px-6 py-4 text-m3-on-surface-variant text-xs whitespace-nowrap">
                    {log.time}
                  </td>
                  <td className="px-6 py-4 font-medium text-m3-on-surface border-l border-transparent hover:border-l hover:border-m3-primary">
                    {log.user}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded ${getTypeStyle(log.type)}`}
                    >
                      {getTypeLabel(log.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-m3-on-surface-variant">{log.action}</td>
                  <td className="px-6 py-4 text-m3-on-surface-variant italic">
                    {log.target}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-m3-outline-variant flex items-center justify-between text-sm">
          <span className="text-m3-on-surface-variant">Hiển thị 10 log gần nhất</span>
          <button className="px-4 py-1.5 text-m3-on-surface-variant bg-m3-surface-high hover:bg-m3-outline-variant rounded-lg transition-colors font-medium">
            Tải thêm...
          </button>
        </div>
      </div>
    </div>
  );
}
