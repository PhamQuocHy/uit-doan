"use client";

import { useEffect, useMemo, useState } from "react";
import { Shield, Plus, Eye, Edit2, User2 } from "lucide-react";
import {
  AdminListHeader,
  AdminListToolbar,
  AdminListShell,
  AdminTable,
  AdminTHead,
  ADMIN_TH_CLS,
  ADMIN_TD_CLS,
  adminRowClass,
  AdminHoverActions,
  AdminIconBtn,
  AdminPill,
  AdminStatusTabs,
  AdminPrimaryBtn,
} from "@/components/admin/list-ui";

const mockReserves = [
  {
    id: "1",
    fullName: "Nguyễn Văn An",
    cccd: "079300012345",
    dob: "2002-03-14",
    unit: "Đại đội 1/Huyện Bình Chánh",
    discharged: "2024-12-31",
    reserveClass: "Hạng 1",
    specialty: "Bộ binh",
    lastTraining: "2025-08-15",
    status: "active",
  },
  {
    id: "2",
    fullName: "Trần Văn Bảo",
    cccd: "079300076543",
    dob: "2000-05-20",
    unit: "Đại đội 2/Huyện Củ Chi",
    discharged: "2023-12-31",
    reserveClass: "Hạng 1",
    specialty: "Công binh",
    lastTraining: "2025-07-10",
    status: "active",
  },
  {
    id: "3",
    fullName: "Lê Thành Công",
    cccd: "079300034567",
    dob: "2001-08-08",
    unit: "Đại đội 3/Huyện Hóc Môn",
    discharged: "2024-06-30",
    reserveClass: "Hạng 2",
    specialty: "Thông tin",
    lastTraining: "2025-06-20",
    status: "inactive",
  },
  {
    id: "4",
    fullName: "Phạm Đức Duy",
    cccd: "079300021098",
    dob: "2003-01-25",
    unit: "Đại đội 1/Huyện Bình Chánh",
    discharged: "2025-12-31",
    reserveClass: "Hạng 1",
    specialty: "Bộ binh",
    lastTraining: "2025-09-01",
    status: "active",
  },
];

const STATUS_TABS = [
  { value: "", label: "Tất cả" },
  { value: "active", label: "Đang hoạt động" },
  { value: "inactive", label: "Ngừng hoạt động" },
] as const;

const STAT_CARD_CLS =
  "rounded-[16px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

export default function ReservePage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(
    () =>
      mockReserves.filter((r) => {
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          r.fullName.toLowerCase().includes(q) ||
          r.cccd.includes(q);
        const matchStatus = !statusFilter || r.status === statusFilter;
        return matchSearch && matchStatus;
      }),
    [search, statusFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  const activeCount = mockReserves.filter((r) => r.status === "active").length;
  const inactiveCount = mockReserves.filter((r) => r.status === "inactive").length;

  return (
    <div className="space-y-4 pb-6">
      <AdminListHeader
        title="Quân nhân dự bị"
        countLabel={`${mockReserves.length} hồ sơ`}
        actions={
          <AdminPrimaryBtn onClick={() => undefined} tone="blue">
            <Plus size={16} />
            Thêm quân nhân dự bị
          </AdminPrimaryBtn>
        }
      />

      <p className="text-[14px] text-m3-on-surface-variant">
        Quản lý danh sách quân nhân dự bị động viên và sẵn sàng chiến đấu
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Tổng quân nhân dự bị",
            value: mockReserves.length,
            color: "var(--m3-on-surface, #1b1d20)",
          },
          {
            label: "Đang hoạt động",
            value: activeCount,
            color: "var(--color-m3-success)",
          },
          {
            label: "Ngừng hoạt động",
            value: inactiveCount,
            color: "var(--m3-on-surface-variant, #475569)",
          },
        ].map((s) => (
          <div key={s.label} className={STAT_CARD_CLS}>
            <div className="mb-2 flex items-center gap-2">
              <Shield size={18} style={{ color: s.color }} />
              <p className="text-[13px] text-m3-on-surface-variant">{s.label}</p>
            </div>
            <p className="text-[28px] font-bold" style={{ color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <AdminListShell
        page={page}
        totalPages={totalPages}
        tabs={
          <AdminStatusTabs
            tabs={[...STATUS_TABS]}
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          />
        }
        toolbar={
          <AdminListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Tìm theo họ tên, số CCCD..."
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        }
      >
        <AdminTable minWidth="min-w-[960px]">
          <AdminTHead>
            <th className={ADMIN_TH_CLS}>Họ và tên</th>
            <th className={ADMIN_TH_CLS}>Đơn vị dự bị</th>
            <th className={ADMIN_TH_CLS}>Xuất ngũ</th>
            <th className={ADMIN_TH_CLS}>Hạng dự bị</th>
            <th className={ADMIN_TH_CLS}>Chuyên ngành</th>
            <th className={ADMIN_TH_CLS}>Huấn luyện gần nhất</th>
            <th className={ADMIN_TH_CLS}>Trạng thái</th>
            <th className={ADMIN_TH_CLS}>Thao tác</th>
          </AdminTHead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant"
                >
                  Không có kết quả phù hợp.
                </td>
              </tr>
            ) : (
              paginated.map((row, idx) => (
                <tr key={row.id} className={adminRowClass(idx)}>
                  <td className={ADMIN_TD_CLS}>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-m3-surface-high">
                        <User2
                          size={14}
                          style={{ color: "var(--m3-primary, #1a73e8)" }}
                        />
                      </div>
                      <div>
                        <div className="text-[14px] font-bold text-m3-on-surface">
                          {row.fullName}
                        </div>
                        <div className="font-mono text-[12px] text-m3-on-surface-variant">
                          {row.cccd}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={`${ADMIN_TD_CLS} text-[12px] text-m3-on-surface-variant`}>
                    {row.unit}
                  </td>
                  <td className={ADMIN_TD_CLS}>
                    {new Date(row.discharged).toLocaleDateString("vi-VN")}
                  </td>
                  <td className={ADMIN_TD_CLS}>
                    <AdminPill
                      label={row.reserveClass}
                      bg={
                        row.reserveClass === "Hạng 1"
                          ? "var(--m3-primary-container, #dae9fb)"
                          : "var(--m3-surface-container-high, #eef1f4)"
                      }
                      color={
                        row.reserveClass === "Hạng 1"
                          ? "var(--m3-primary, #1a73e8)"
                          : "var(--m3-on-surface-variant, #475569)"
                      }
                    />
                  </td>
                  <td className={`${ADMIN_TD_CLS} text-m3-on-surface-variant`}>
                    {row.specialty}
                  </td>
                  <td className={`${ADMIN_TD_CLS} text-m3-on-surface-variant`}>
                    {new Date(row.lastTraining).toLocaleDateString("vi-VN")}
                  </td>
                  <td className={ADMIN_TD_CLS}>
                    <AdminPill
                      label={row.status === "active" ? "Hoạt động" : "Ngừng"}
                      bg={
                        row.status === "active"
                          ? "var(--color-m3-success-container)"
                          : "var(--m3-surface-container-high, #eef1f4)"
                      }
                      color={
                        row.status === "active"
                          ? "var(--color-m3-success)"
                          : "var(--m3-on-surface-variant, #475569)"
                      }
                    />
                  </td>
                  <td className={`relative ${ADMIN_TD_CLS}`}>
                    <span className="text-[13px] text-m3-on-surface-variant">—</span>
                    <AdminHoverActions>
                      <AdminIconBtn title="Xem" onClick={() => undefined} tone="gray">
                        <Eye size={15} />
                      </AdminIconBtn>
                      <AdminIconBtn title="Sửa" onClick={() => undefined} tone="blue">
                        <Edit2 size={15} />
                      </AdminIconBtn>
                    </AdminHoverActions>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </AdminTable>
      </AdminListShell>
    </div>
  );
}
