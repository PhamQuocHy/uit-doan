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
          <h1 className="text-2xl font-bold" style={{ color: "#3b491e" }}>
            Vai trò & Quyền hạn
          </h1>
          <p className="text-sm mt-1" style={{ color: "#748c2c" }}>
            Quản lý các nhóm quyền và gán quyền cho người dùng hệ thống
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#748c2c] hover:bg-[#586c23] text-white rounded-xl transition-colors text-sm font-medium">
          <Plus size={16} />
          Thêm Vai trò
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#edf4dc] overflow-hidden">
        <div className="p-4 border-b border-[#edf4dc] flex gap-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Tìm kiếm vai trò..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#748c2c] transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8fae8]/50 text-[#586c23] font-medium border-b border-[#edf4dc]">
              <tr>
                <th className="px-6 py-4">Tên Vai trò</th>
                <th className="px-6 py-4">Mô tả quyền hạn</th>
                <th className="px-6 py-4 text-center">Số lượng User</th>
                <th className="px-6 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roles.map((role) => (
                <tr
                  key={role.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-[#93a83e]" />
                      {role.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 max-w-md">
                    {role.description}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                      {role.usersCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
