import { redirect } from "next/navigation";
import { Users, UserCheck, Building2, UserX, ShieldCheck } from "lucide-react";
import { db } from "@/lib/data";
import { getSession } from "@/lib/auth";
import StatCard from "@/components/ui/StatCard";
import bgImage from "@/assets/images/bg2.jpg";

export default async function AdminDashboard() {
  const session = await getSession();
  if (session?.hierarchyLevel === "donvi") {
    redirect("/admin/receiving");
  }

  const stats = db.stats.getOverview();
  const recentUsers = db.users.findAll({ page: 1, limit: 5 });

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div
        className="rounded-3xl p-6 text-white relative overflow-hidden"
        style={{
          backgroundImage: `url(${bgImage.src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          border: "1px solid #c5d38c",
          boxShadow: "0 8px 30px rgba(116,140,44,0.15)",
        }}
      >
        {/* Overlay to ensure text readability */}
        <div className="absolute inset-0 bg-black/65 pointer-events-none" />

        {/* Camo dots */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`,
            backgroundSize: "20px 20px",
          }}
        />
        <div className="relative flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-wide mt-2">
              Chào mừng trở lại, Admin
            </h2>
            <p
              className="text-base md:text-lg mt-2 font-normal"
              style={{ color: "#edf4dc" }}
            >
              Hệ thống Quản lý thông tin nghĩa vụ quân sự —{" "}
              {new Date().toLocaleDateString("vi-VN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div
            className="hidden md:flex items-center justify-center w-24 h-24 rounded-full"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              backdropFilter: "blur(4px)",
            }}
          >
            <ShieldCheck size={48} style={{ color: "#ffffff" }} />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Tổng quân nhân"
          value={stats.totalUsers}
          color="olive"
          icon={<Users size={20} />}
          trend={{ value: 12, label: "tháng này" }}
        />
        <StatCard
          title="Đang phục vụ"
          value={stats.activeUsers}
          color="forest"
          icon={<UserCheck size={20} />}
        />
        <StatCard
          title="Đơn vị"
          value={stats.totalDepartments}
          color="khaki"
          icon={<Building2 size={20} />}
          subtitle={`${stats.activeDepartments} đang hoạt động`}
        />
        <StatCard
          title="Chỉ huy"
          value={stats.totalAdmins}
          color="earth"
          icon={<ShieldCheck size={20} />}
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent table */}
        <div
          className="lg:col-span-2 rounded-3xl overflow-hidden"
          style={{
            background: "#ffffff",
            border: "1px solid #edf4dc",
            boxShadow: "0 8px 30px rgba(0,0,0,0.03)",
          }}
        >
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: "1px solid #e5e8d0" }}
          >
            <h3
              className="font-bold tracking-wider uppercase text-sm"
              style={{ color: "#2b3012", letterSpacing: "0.06em" }}
            >
              Quân nhân gần đây
            </h3>
            <a
              href="/admin/users"
              className="text-xs font-bold tracking-wide uppercase transition-colors hover:bg-gray-50 px-3 py-1.5 rounded-lg"
              style={{ color: "#748c2c" }}
            >
              Xem tất cả →
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid #edf4dc",
                    background: "#f8fae8",
                  }}
                >
                  <th
                    className="text-left px-6 py-3.5 text-xs font-bold uppercase tracking-widest"
                    style={{ color: "#586c23" }}
                  >
                    Họ tên
                  </th>
                  <th
                    className="text-left px-6 py-3.5 text-xs font-bold uppercase tracking-widest hidden md:table-cell"
                    style={{ color: "#586c23" }}
                  >
                    Email
                  </th>
                  <th
                    className="text-left px-6 py-3.5 text-xs font-bold uppercase tracking-widest hidden sm:table-cell"
                    style={{ color: "#586c23" }}
                  >
                    Đơn vị
                  </th>
                  <th
                    className="text-left px-6 py-3.5 text-xs font-bold uppercase tracking-widest"
                    style={{ color: "#586c23" }}
                  >
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.data.map((user, idx) => (
                  <tr
                    key={user.id}
                    className="transition-colors"
                    style={{
                      borderBottom:
                        idx < recentUsers.data.length - 1
                          ? "1px solid #edf4dc"
                          : "none",
                    }}
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            background: "#f8fae8",
                            border: "1px solid #dce7ba",
                          }}
                        >
                          <span
                            className="text-sm font-bold"
                            style={{ color: "#748c2c" }}
                          >
                            {user.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p
                            className="font-semibold"
                            style={{ color: "#3b491e" }}
                          >
                            {user.name}
                          </p>
                          <p
                            className="text-xs font-medium"
                            style={{ color: "#748c2c" }}
                          >
                            @{user.username}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td
                      className="px-6 py-4 hidden md:table-cell"
                      style={{ color: "#586c23" }}
                    >
                      {user.email}
                    </td>
                    <td
                      className="px-6 py-4 hidden sm:table-cell"
                      style={{ color: "#586c23" }}
                    >
                      {user.department}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
                        style={
                          user.status === "active"
                            ? {
                                background: "#f8fae8",
                                color: "#586c23",
                                border: "1px solid #c5d38c",
                              }
                            : {
                                background: "#fef2f2",
                                color: "#dc2626",
                                border: "1px solid #fecaca",
                              }
                        }
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background:
                              user.status === "active" ? "#748c2c" : "#dc2626",
                          }}
                        />
                        {user.status === "active" ? "Tại ngũ" : "Xuất ngũ"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Department Overview */}
        <div
          className="rounded-3xl bg-white"
          style={{
            border: "1px solid #edf4dc",
            boxShadow: "0 8px 30px rgba(0,0,0,0.03)",
          }}
        >
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: "1px solid #e5e8d0" }}
          >
            <h3
              className="font-bold tracking-wider uppercase text-sm"
              style={{ color: "#2b3012", letterSpacing: "0.06em" }}
            >
              Đơn vị
            </h3>
            <a
              href="/admin/departments"
              className="text-xs font-bold tracking-wide uppercase hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "#748c2c" }}
            >
              Xem tất cả →
            </a>
          </div>
          <div className="p-4 space-y-1.5">
            {db.departments.findAll({ limit: 6 }).data.map((dept) => (
              <div
                key={dept.id}
                className="flex items-center justify-between p-3 rounded-xl transition-colors"
                style={{ cursor: "default" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "#f8fae8",
                      border: "1px solid #dce7ba",
                    }}
                  >
                    <span
                      className="text-xs font-black"
                      style={{ color: "#748c2c" }}
                    >
                      {dept.code.slice(0, 3)}
                    </span>
                  </div>
                  <div>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "#3b491e" }}
                    >
                      {dept.name}
                    </p>
                    <p
                      className="text-xs font-medium mt-0.5"
                      style={{ color: "#748c2c" }}
                    >
                      {dept.memberCount} quân nhân
                    </p>
                  </div>
                </div>
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    background:
                      dept.status === "active" ? "#748c2c" : "#e0e0dc",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
