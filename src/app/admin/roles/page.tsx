"use client";

import { ShieldCheck, Plus, Search, Edit2, Trash2 } from "lucide-react";

export default function RolesPage() {
  const roles = [
    {
      id: 1,
      name: "Quản trị viên (Admin)",
      usersCount: 5,
      description: "Toàn quyền hệ thống, quản lý tài khoản, cấu hình tham số.",
    },
    {
      id: 2,
      name: "Chỉ huy Trưởng",
      usersCount: 12,
      description:
        "Phê duyệt các quyết định gọi khám, chốt danh sách trúng tuyển.",
    },
    {
      id: 3,
      name: "Ban Tuyển sinh Quân sự",
      usersCount: 28,
      description: "Quản lý dữ liệu công dân, xét duyệt học vấn và thường trú.",
    },
    {
      id: 4,
      name: "Hội đồng Khám sức khỏe",
      usersCount: 45,
      description:
        "Cập nhật, đánh giá và kết luận phân loại sức khỏe công dân.",
    },
    {
      id: 5,
      name: "Cán bộ cấp Xã/Phường",
      usersCount: 156,
      description:
        "Cập nhật danh sách công dân nam trong độ tuổi tại địa phương.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
            Vai trò & Quyền hạn
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m3-primary, #1a73e8)" }}>
            Quản lý các nhóm quyền và gán quyền cho người dùng hệ thống
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-m3-primary hover:bg-m3-on-surface-variant text-white rounded-xl transition-colors text-sm font-medium">
          <Plus size={16} />
          Thêm Vai trò
        </button>
      </div>

      <div className="bg-m3-surface-lowest rounded-2xl shadow-sm border border-m3-outline-variant overflow-hidden">
        <div className="p-4 border-b border-m3-outline-variant flex gap-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
              size={18}
            />
            <input
              type="text"
              placeholder="Tìm kiếm vai trò..."
              className="w-full pl-10 pr-4 py-2 border border-m3-outline-variant rounded-xl text-sm focus:outline-none focus:border-m3-primary transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-m3-surface-high/50 text-m3-on-surface-variant font-medium border-b border-m3-outline-variant">
              <tr>
                <th className="px-6 py-4">Tên Vai trò</th>
                <th className="px-6 py-4">Mô tả quyền hạn</th>
                <th className="px-6 py-4 text-center">Số lượng User</th>
                <th className="px-6 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-m3-outline-variant">
              {roles.map((role) => (
                <tr
                  key={role.id}
                  className="hover:bg-m3-surface-high/50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-m3-on-surface">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-m3-on-surface-variant" />
                      {role.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-m3-on-surface-variant max-w-md">
                    {role.description}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold rounded-full bg-m3-primary-container text-m3-primary border border-m3-primary">
                      {role.usersCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-1.5 text-m3-on-surface-variant hover:text-m3-primary hover:bg-m3-primary-container rounded-lg transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button className="p-1.5 text-m3-on-surface-variant hover:text-m3-on-error-container hover:bg-m3-error-container rounded-lg transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
