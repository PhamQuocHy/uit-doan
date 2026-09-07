"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  User2,
  X,
  Send,
  Shield,
  Clock,
} from "lucide-react";
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

const STAT_CARD_CLS =
  "rounded-[16px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

interface Session {
  hierarchyLevel: string;
  unitCode: string;
  name: string;
}

// ── Mock receiving units (for bo view) ─────────────────────────────────────
const mockUnits = [
  {
    id: "u1",
    name: "Sư đoàn 1 – Quân khu 1",
    quota: 120,
    received: 120,
    status: "confirmed" as const,
    lastUpdate: "2026-03-01",
  },
  {
    id: "u2",
    name: "Sư đoàn 2 – Quân khu 3",
    quota: 80,
    received: 72,
    status: "pending" as const,
    lastUpdate: "2026-03-02",
  },
  {
    id: "u3",
    name: "Lữ đoàn 25 – Quân khu 5",
    quota: 60,
    received: 60,
    status: "confirmed" as const,
    lastUpdate: "2026-03-01",
  },
  {
    id: "u4",
    name: "Sư đoàn 5 – Quân khu 7",
    quota: 90,
    received: 45,
    status: "pending" as const,
    lastUpdate: "2026-03-03",
  },
  {
    id: "u5",
    name: "Trung đoàn 10 – Quân khu 9",
    quota: 50,
    received: 50,
    status: "confirmed" as const,
    lastUpdate: "2026-03-01",
  },
];

// ── Mock soldiers (for donvi view) ─────────────────────────────────────────
interface Soldier {
  id: string;
  fullName: string;
  cccd: string;
  dob: string;
  origin: string;
  healthClass: string;
  arrivalStatus: "pending" | "arrived" | "absent";
  unitReport: "" | "ok" | "health_issue";
  reportNote: string;
}

const mockSoldiers: Soldier[] = [
  {
    id: "s1",
    fullName: "Nguyễn Văn An",
    cccd: "079300012345",
    dob: "2002-03-14",
    origin: "Xã Hàng Bông, Hoàn Kiếm, Hà Nội",
    healthClass: "A1",
    arrivalStatus: "arrived",
    unitReport: "",
    reportNote: "",
  },
  {
    id: "s2",
    fullName: "Trần Minh Bảo",
    cccd: "079300076543",
    dob: "2003-07-22",
    origin: "Xã Hàng Đào, Hoàn Kiếm, Hà Nội",
    healthClass: "A",
    arrivalStatus: "arrived",
    unitReport: "",
    reportNote: "",
  },
  {
    id: "s3",
    fullName: "Phạm Quốc Duy",
    cccd: "079300021098",
    dob: "2003-01-25",
    origin: "Xã Bình Hưng, Bình Chánh, TP.HCM",
    healthClass: "A1",
    arrivalStatus: "arrived",
    unitReport: "",
    reportNote: "",
  },
  {
    id: "s4",
    fullName: "Đặng Minh Quân",
    cccd: "079300043219",
    dob: "2002-09-30",
    origin: "Xã Hàng Đào, Hoàn Kiếm, Hà Nội",
    healthClass: "A",
    arrivalStatus: "arrived",
    unitReport: "",
    reportNote: "",
  },
  {
    id: "s5",
    fullName: "Bùi Văn Hùng",
    cccd: "079300067890",
    dob: "2003-04-12",
    origin: "Xã Khâm Thiên, Đống Đa, Hà Nội",
    healthClass: "A1",
    arrivalStatus: "pending",
    unitReport: "",
    reportNote: "",
  },
  {
    id: "s6",
    fullName: "Vũ Thanh Phát",
    cccd: "079300098765",
    dob: "2004-05-03",
    origin: "Xã Hàng Bông, Hoàn Kiếm, Hà Nội",
    healthClass: "A",
    arrivalStatus: "absent",
    unitReport: "",
    reportNote: "",
  },
  {
    id: "s7",
    fullName: "Hoàng Văn Em",
    cccd: "079300058432",
    dob: "2002-11-19",
    origin: "Xã Long Hòa, Bình Chánh, TP.HCM",
    healthClass: "B",
    arrivalStatus: "arrived",
    unitReport: "health_issue",
    reportNote: "Huyết áp cao không đảm bảo sức khỏe chiến đấu",
  },
];

const arrivalConfig = {
  arrived: { label: "Đã trình diện", color: "var(--color-m3-success)", bg: "var(--color-m3-success-container)" },
  pending: { label: "Chưa lên", color: "var(--color-m3-warning)", bg: "var(--color-m3-warning-container)" },
  absent: { label: "Vắng mặt", color: "var(--m3-error, #ba1a1a)", bg: "var(--m3-error-container, var(--m3-error-container, #ffdad6))" },
};

// \u2500\u2500 BO VIEW: read-only unit overview \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const boMockUnits = [
  {
    id: "u1",
    name: "S\u01b0 \u0111o\u00e0n 1 \u2013 Qu\u00e2n khu 1",
    quota: 120,
    received: 120,
    status: "confirmed" as const,
    lastUpdate: "2026-03-01",
    note: "",
  },
  {
    id: "u2",
    name: "S\u01b0 \u0111o\u00e0n 2 \u2013 Qu\u00e2n khu 3",
    quota: 80,
    received: 72,
    status: "pending" as const,
    lastUpdate: "2026-03-02",
    note: "",
  },
  {
    id: "u3",
    name: "L\u1eef \u0111o\u00e0n 25 \u2013 Qu\u00e2n khu 5",
    quota: 60,
    received: 60,
    status: "confirmed" as const,
    lastUpdate: "2026-03-01",
    note: "",
  },
  {
    id: "u4",
    name: "S\u01b0 \u0111o\u00e0n 5 \u2013 Qu\u00e2n khu 7",
    quota: 90,
    received: 45,
    status: "supplement_needed" as const,
    lastUpdate: "2026-03-03",
    note: "4 QN s\u1ee9c kh\u1ecfe kh\u00f4ng \u0111\u1ea3m b\u1ea3o, y\u00eau c\u1ea7u b\u1ed5 sung",
  },
  {
    id: "u5",
    name: "Trung \u0111o\u00e0n 10 \u2013 Qu\u00e2n khu 9",
    quota: 50,
    received: 50,
    status: "confirmed" as const,
    lastUpdate: "2026-03-01",
    note: "",
  },
];

const mockUnqualifiedSoldiers = [
  {
    id: "uq1",
    fullName: "Ngô Thành Nhân",
    cccd: "079300011112",
    dateOfBirth: "2001-12-05",
    origin: "Huyện Bình Chánh, TP.HCM",
    unitReceived: "Sư đoàn 5 – Quân khu 7",
    reason: "Huyết áp cao không đảm bảo sức khỏe chiến đấu",
    reportDate: "2026-03-03",
  },
  {
    id: "uq2",
    fullName: "Trần Thế Khoa",
    cccd: "079300055533",
    dateOfBirth: "2003-08-15",
    origin: "Huyện Củ Chi, TP.HCM",
    unitReceived: "Sư đoàn 5 – Quân khu 7",
    reason: "Suy nhược cơ thể",
    reportDate: "2026-03-03",
  },
  {
    id: "uq3",
    fullName: "Lê Minh Trí",
    cccd: "079300077744",
    dateOfBirth: "2002-01-20",
    origin: "Quận Hoàn Kiếm, Hà Nội",
    unitReceived: "Sư đoàn 5 – Quân khu 7",
    reason: "Thị lực giảm sút do chấn thương",
    reportDate: "2026-03-03",
  },
  {
    id: "uq4",
    fullName: "Phạm Hùng Cường",
    cccd: "079300099955",
    dateOfBirth: "2004-11-10",
    origin: "Quận Cầu Giấy, Hà Nội",
    unitReceived: "Sư đoàn 5 – Quân khu 7",
    reason: "Bệnh lý tim mạch",
    reportDate: "2026-03-03",
  },
];

const BO_STATUS_TABS = [
  { value: "", label: "Tất cả" },
  { value: "confirmed", label: "Đã nhận đủ" },
  { value: "pending", label: "Chờ xác nhận" },
  { value: "supplement_needed", label: "Cần bổ sung" },
] as const;

function BoView() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [notePopover, setNotePopover] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(
    () =>
      boMockUnits.filter((u) => {
        const matchSearch =
          !search || u.name.toLowerCase().includes(search.toLowerCase());
        const matchStatus = !statusFilter || u.status === statusFilter;
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

  const confirmedCount = boMockUnits.filter(
    (u) => u.status === "confirmed",
  ).length;
  const supplementCount = boMockUnits.filter(
    (u) => u.status === "supplement_needed",
  ).length;
  const pendingCount = boMockUnits.filter((u) => u.status === "pending").length;
  const totalQuota = boMockUnits.reduce((s, u) => s + u.quota, 0);
  const totalReceived = boMockUnits.reduce((s, u) => s + u.received, 0);

  const statusConf = {
    confirmed: {
      label: "\u0110\u00e3 nh\u1eadn \u0111\u1ee7",
      color: "var(--color-m3-success)",
      bg: "var(--color-m3-success-container)",
      Icon: CheckCircle2,
    },
    pending: {
      label: "Ch\u1edd x\u00e1c nh\u1eadn",
      color: "var(--color-m3-warning)",
      bg: "var(--color-m3-warning-container)",
      Icon: Clock,
    },
    supplement_needed: {
      label: "C\u1ea7n b\u1ed5 sung",
      color: "var(--m3-error, #ba1a1a)",
      bg: "var(--m3-error-container, var(--m3-error-container, #ffdad6))",
      Icon: AlertTriangle,
    },
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminListHeader
        title="Đơn vị nhận quân"
        countLabel={`${boMockUnits.length} đơn vị`}
      />

      <p className="text-[14px] text-m3-on-surface-variant">
        Theo dõi tình trạng nhận quân của tất cả đơn vị
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Tổng đơn vị",
            value: boMockUnits.length,
            color: "var(--m3-on-surface, #1b1d20)",
          },
          {
            label: "Đã nhận đủ quân",
            value: confirmedCount,
            color: "var(--color-m3-success)",
          },
          {
            label: "Chờ xác nhận",
            value: pendingCount,
            color: "var(--color-m3-warning)",
          },
          {
            label: "Cần bổ sung",
            value: supplementCount,
            color: "var(--m3-error, #ba1a1a)",
          },
        ].map((s) => (
          <div key={s.label} className={STAT_CARD_CLS}>
            <p className="text-[12px] text-m3-on-surface-variant">{s.label}</p>
            <p
              className="mt-1 text-[24px] font-bold"
              style={{ color: s.color }}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className={STAT_CARD_CLS}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-medium text-m3-on-surface-variant">
            Tổng tiến độ nhận quân
          </p>
          <span
            className="text-[13px] font-bold"
            style={{ color: "var(--m3-primary, #1a73e8)" }}
          >
            {totalReceived}/{totalQuota} (
            {Math.round((totalReceived / totalQuota) * 100)}%)
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-m3-surface-container">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round((totalReceived / totalQuota) * 100)}%`,
              background: "var(--m3-primary, #1a73e8)",
            }}
          />
        </div>
      </div>

      <AdminListShell
        page={page}
        totalPages={totalPages}
        tabs={
          <AdminStatusTabs
            tabs={[...BO_STATUS_TABS]}
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
            searchPlaceholder="Tìm đơn vị..."
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
        <AdminTable minWidth="min-w-[900px]">
          <AdminTHead>
            <th className={ADMIN_TH_CLS}>Đơn vị nhận quân</th>
            <th className={`${ADMIN_TH_CLS} text-center`}>Chỉ tiêu</th>
            <th className={`${ADMIN_TH_CLS} text-center`}>Đã nhận</th>
            <th className={ADMIN_TH_CLS}>Tiến độ</th>
            <th className={ADMIN_TH_CLS}>Trạng thái</th>
            <th className={ADMIN_TH_CLS}>Cập nhật</th>
          </AdminTHead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant"
                >
                  Không có kết quả
                </td>
              </tr>
            ) : (
              paginated.map((u, idx) => {
                const pct = Math.round((u.received / u.quota) * 100);
                const sc = statusConf[u.status];
                return (
                  <tr
                    key={u.id}
                    className={adminRowClass(
                      idx,
                      u.status === "supplement_needed"
                        ? "bg-red-50/60 hover:bg-red-50/80"
                        : "",
                    )}
                  >
                    <td className={ADMIN_TD_CLS}>
                      <div className="flex items-center gap-2">
                        <div className="relative shrink-0">
                          {u.status === "supplement_needed" ? (
                            <button
                              type="button"
                              onClick={() =>
                                setNotePopover(
                                  notePopover === u.id ? null : u.id,
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-m3-error-container ring-2 ring-m3-error transition-colors hover:bg-m3-error-container"
                              title="Xem lý do cần bổ sung"
                            >
                              <Shield size={13} className="text-m3-error" />
                              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-m3-error-container text-[10px] font-bold leading-none text-white">
                                !
                              </span>
                            </button>
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-m3-surface-high">
                              <Shield
                                size={13}
                                style={{ color: "var(--m3-primary, #1a73e8)" }}
                              />
                            </div>
                          )}
                          {notePopover === u.id && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                              <div className="animate-in fade-in zoom-in w-full max-w-4xl overflow-hidden rounded-3xl bg-m3-surface-lowest shadow-2xl duration-200">
                                <div className="p-6">
                                  <div className="mb-6 flex items-center gap-3">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-m3-error-container">
                                      <AlertTriangle
                                        size={24}
                                        className="text-m3-error"
                                      />
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-bold text-m3-on-surface">
                                        Chi tiết lý do bổ sung
                                      </h3>
                                      <p className="text-sm text-m3-on-surface-variant">
                                        {u.name}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setNotePopover(null)}
                                      className="ml-auto rounded-xl p-2 text-m3-on-surface-variant transition-colors hover:bg-m3-surface-container"
                                    >
                                      <X size={20} />
                                    </button>
                                  </div>

                                  <div className="mb-6 rounded-2xl border border-m3-error bg-m3-error-container/50 p-4">
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-m3-on-surface-variant">
                                      {u.note}
                                    </p>
                                  </div>

                                  <div className="mb-6 overflow-hidden rounded-xl border border-m3-outline-variant">
                                    <table className="w-full text-left text-sm">
                                      <thead className="border-b border-m3-outline-variant bg-m3-surface-high font-medium text-m3-on-surface-variant">
                                        <tr>
                                          <th className="px-4 py-3">
                                            Quân nhân
                                          </th>
                                          <th className="px-4 py-3">
                                            Quê quán
                                          </th>
                                          <th className="px-4 py-3">
                                            Lý do từ chối
                                          </th>
                                          <th className="px-4 py-3 text-center">
                                            Ngày báo cáo
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-m3-outline-variant">
                                        {mockUnqualifiedSoldiers
                                          .filter(
                                            (s) => s.unitReceived === u.name,
                                          )
                                          .map((soldier) => (
                                            <tr
                                              key={soldier.id}
                                              className="hover:bg-m3-surface-high"
                                            >
                                              <td className="px-4 py-3">
                                                <div className="font-medium text-m3-on-surface">
                                                  {soldier.fullName}
                                                </div>
                                                <div className="mt-0.5 font-mono text-xs text-m3-on-surface-variant">
                                                  {soldier.cccd}
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 text-m3-on-surface-variant">
                                                {soldier.origin}
                                              </td>
                                              <td className="px-4 py-3 font-medium italic text-m3-on-error-container">
                                                {soldier.reason}
                                              </td>
                                              <td className="px-4 py-3 text-center text-m3-on-surface-variant">
                                                {new Date(
                                                  soldier.reportDate,
                                                ).toLocaleDateString("vi-VN")}
                                              </td>
                                            </tr>
                                          ))}
                                        {mockUnqualifiedSoldiers.filter(
                                          (s) => s.unitReceived === u.name,
                                        ).length === 0 && (
                                          <tr>
                                            <td
                                              colSpan={4}
                                              className="px-4 py-6 text-center text-m3-on-surface-variant"
                                            >
                                              Không có dữ liệu chi tiết báo cáo
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => setNotePopover(null)}
                                    className="w-full rounded-2xl bg-m3-surface-highest py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-black active:scale-95"
                                  >
                                    Đã hiểu
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-m3-on-surface">
                          {u.name}
                        </span>
                      </div>
                    </td>
                    <td
                      className={`${ADMIN_TD_CLS} text-center font-semibold text-m3-on-surface-variant`}
                    >
                      {u.quota}
                    </td>
                    <td
                      className={`${ADMIN_TD_CLS} text-center font-semibold text-m3-on-surface`}
                    >
                      {u.received}
                    </td>
                    <td className={`${ADMIN_TD_CLS} min-w-[130px]`}>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-m3-surface-container">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              background:
                                pct >= 100
                                  ? "var(--color-m3-success)"
                                  : "var(--m3-primary, #1a73e8)",
                            }}
                          />
                        </div>
                        <span className="w-7 text-xs text-m3-on-surface-variant">
                          {pct}%
                        </span>
                      </div>
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      <AdminPill
                        label={sc.label}
                        bg={sc.bg}
                        color={sc.color}
                      />
                    </td>
                    <td className={`${ADMIN_TD_CLS} text-xs text-m3-on-surface-variant`}>
                      {new Date(u.lastUpdate).toLocaleDateString("vi-VN")}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </AdminTable>
      </AdminListShell>
    </div>
  );
}

const ARRIVAL_TABS = [
  { value: "", label: "Tất cả" },
  { value: "arrived", label: "Đã trình diện" },
  { value: "pending", label: "Chưa lên" },
  { value: "absent", label: "Vắng mặt" },
] as const;

// ── DONVI VIEW: soldier detail ──────────────────────────────────────────────
function DonViView() {
  const [soldiers, setSoldiers] = useState<Soldier[]>(mockSoldiers);
  const [search, setSearch] = useState("");
  const [arrivalFilter, setArrivalFilter] = useState("");
  const [reportModal, setReportModal] = useState<Soldier | null>(null);
  const [reportType, setReportType] = useState<"ok" | "health_issue">(
    "health_issue",
  );
  const [reportNote, setReportNote] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(
    () =>
      soldiers.filter((s) => {
        const matchSearch =
          !search ||
          s.fullName.toLowerCase().includes(search.toLowerCase()) ||
          s.cccd.includes(search);
        const matchArrival = !arrivalFilter || s.arrivalStatus === arrivalFilter;
        return matchSearch && matchArrival;
      }),
    [soldiers, search, arrivalFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, arrivalFilter, pageSize]);

  const arrivedCount = soldiers.filter(
    (s) => s.arrivalStatus === "arrived",
  ).length;
  const reportedIssues = soldiers.filter(
    (s) => s.unitReport === "health_issue",
  ).length;
  const confirmedOk = soldiers.filter((s) => s.unitReport === "ok").length;

  const handleConfirmAll = () => {
    setSoldiers((prev) =>
      prev.map((s) =>
        s.arrivalStatus === "arrived" && !s.unitReport
          ? { ...s, unitReport: "ok" }
          : s,
      ),
    );
    setConfirmAll(true);
  };

  const handleReport = (soldier: Soldier) => {
    setSoldiers((prev) =>
      prev.map((s) =>
        s.id === soldier.id
          ? {
              ...s,
              unitReport: reportType,
              reportNote: reportType === "ok" ? "" : reportNote,
            }
          : s,
      ),
    );
    setReportModal(null);
    setReportNote("");
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminListHeader
        title="Đơn vị nhận quân"
        countLabel={`${soldiers.length} quân nhân`}
        actions={
          !confirmAll ? (
            <AdminPrimaryBtn onClick={handleConfirmAll}>
              <CheckCircle2 size={16} />
              Xác nhận đủ quân
            </AdminPrimaryBtn>
          ) : (
            <span className="inline-flex h-10 items-center gap-2 rounded-full border border-m3-success bg-m3-success-container px-4 text-[13px] font-semibold text-m3-on-success-container">
              <CheckCircle2 size={16} /> Đã xác nhận đủ quân
            </span>
          )
        }
      />

      <p className="text-[14px] text-m3-on-surface-variant">
        Xác nhận danh sách nhận quân và báo cáo tình trạng sức khỏe
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Tổng quân nhân",
            value: soldiers.length,
            color: "var(--m3-on-surface, #1b1d20)",
          },
          {
            label: "Đã trình diện",
            value: arrivedCount,
            color: "var(--color-m3-success)",
          },
          {
            label: "Báo cáo đủ SK",
            value: confirmedOk,
            color: "var(--m3-primary, #1a73e8)",
          },
          {
            label: "SK không đảm bảo",
            value: reportedIssues,
            color: "var(--m3-error, #ba1a1a)",
          },
        ].map((s) => (
          <div key={s.label} className={STAT_CARD_CLS}>
            <p className="text-[12px] text-m3-on-surface-variant">{s.label}</p>
            <p
              className="mt-1 text-[28px] font-bold"
              style={{ color: s.color }}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className={STAT_CARD_CLS}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-medium text-m3-on-surface-variant">
            Tiến độ nhận quân
          </p>
          <span
            className="text-[13px] font-bold"
            style={{ color: "var(--m3-primary, #1a73e8)" }}
          >
            {arrivedCount}/{soldiers.length} (
            {Math.round((arrivedCount / soldiers.length) * 100)}%)
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-m3-surface-container">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round((arrivedCount / soldiers.length) * 100)}%`,
              background: "var(--m3-primary, #1a73e8)",
            }}
          />
        </div>
      </div>

      <AdminListShell
        page={page}
        totalPages={totalPages}
        tabs={
          <AdminStatusTabs
            tabs={[...ARRIVAL_TABS]}
            value={arrivalFilter}
            onChange={(v) => {
              setArrivalFilter(v);
              setPage(1);
            }}
          />
        }
        toolbar={
          <AdminListToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Tìm họ tên, CCCD..."
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
            <th className={ADMIN_TH_CLS}>Quân nhân</th>
            <th className={ADMIN_TH_CLS}>Quê quán</th>
            <th className={`${ADMIN_TH_CLS} text-center`}>Phân loại SK</th>
            <th className={ADMIN_TH_CLS}>Trình diện</th>
            <th className={ADMIN_TH_CLS}>Báo cáo</th>
            <th className={ADMIN_TH_CLS}>Thao tác</th>
          </AdminTHead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-[14px] text-m3-on-surface-variant"
                >
                  Không có kết quả
                </td>
              </tr>
            ) : (
              paginated.map((s, idx) => {
                const ac = arrivalConfig[s.arrivalStatus];
                return (
                  <tr key={s.id} className={adminRowClass(idx)}>
                    <td className={ADMIN_TD_CLS}>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-m3-surface-high">
                          <User2
                            size={12}
                            style={{ color: "var(--m3-primary, #1a73e8)" }}
                          />
                        </div>
                        <div>
                          <div className="text-[14px] font-bold text-m3-on-surface">
                            {s.fullName}
                          </div>
                          <div className="font-mono text-[12px] text-m3-on-surface-variant">
                            {s.cccd}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td
                      className={`${ADMIN_TD_CLS} max-w-[160px] text-[12px] text-m3-on-surface-variant`}
                    >
                      {s.origin}
                    </td>
                    <td className={`${ADMIN_TD_CLS} text-center`}>
                      <AdminPill
                        label={s.healthClass}
                        bg="var(--m3-primary-container, #dae9fb)"
                        color="var(--m3-primary, #1a73e8)"
                      />
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      <AdminPill
                        label={ac.label}
                        bg={ac.bg}
                        color={ac.color}
                      />
                    </td>
                    <td className={ADMIN_TD_CLS}>
                      {s.unitReport === "ok" && (
                        <AdminPill
                          label="Đủ SK"
                          bg="var(--color-m3-success-container)"
                          color="var(--color-m3-success)"
                        />
                      )}
                      {s.unitReport === "health_issue" && (
                        <div>
                          <AdminPill
                            label="SK không đảm bảo"
                            bg="var(--m3-error-container, #ffdad6)"
                            color="var(--m3-error, #ba1a1a)"
                          />
                          {s.reportNote ? (
                            <p className="mt-0.5 text-[12px] italic text-m3-on-surface-variant">
                              {s.reportNote}
                            </p>
                          ) : null}
                        </div>
                      )}
                      {!s.unitReport && (
                        <span className="text-[12px] text-m3-on-surface-variant">
                          Chưa báo cáo
                        </span>
                      )}
                    </td>
                    <td className={`relative ${ADMIN_TD_CLS}`}>
                      {s.arrivalStatus === "arrived" && !s.unitReport ? (
                        <span className="text-[12px] text-m3-on-surface-variant">
                          Chờ báo cáo
                        </span>
                      ) : (
                        <span className="text-[12px] italic text-m3-on-surface-variant">
                          {s.unitReport ? "Đã báo" : "—"}
                        </span>
                      )}
                      {s.arrivalStatus === "arrived" && !s.unitReport ? (
                        <AdminHoverActions>
                          <AdminIconBtn
                            title="Báo cáo"
                            onClick={() => {
                              setReportModal(s);
                              setReportType("health_issue");
                              setReportNote("");
                            }}
                            tone="blue"
                          >
                            <Send size={14} />
                          </AdminIconBtn>
                        </AdminHoverActions>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </AdminTable>
      </AdminListShell>

      {reportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-[16px] border border-black/[0.06] bg-white shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-m3-outline-variant">
              <h2 className="text-base font-semibold text-m3-on-surface">
                Báo cáo tình trạng quân nhân
              </h2>
              <button
                onClick={() => setReportModal(null)}
                className="p-1.5 hover:bg-m3-surface-container rounded-lg"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 p-3 bg-m3-surface-high rounded-xl">
                <div className="w-8 h-8 rounded-full bg-m3-surface-high flex items-center justify-center">
                  <Shield size={13} style={{ color: "var(--m3-primary, #1a73e8)" }} />
                </div>
                <div>
                  <p className="font-medium text-m3-on-surface text-sm">
                    {reportModal.fullName}
                  </p>
                  <p className="text-xs text-m3-on-surface-variant font-mono">
                    {reportModal.cccd}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-m3-on-surface-variant block mb-2">
                  Kết quả *
                </label>
                <div className="flex gap-3">
                  <label
                    className="flex-1 flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer"
                    style={
                      reportType === "ok"
                        ? { borderColor: "var(--color-m3-success)", background: "var(--color-m3-success-container)" }
                        : { borderColor: "var(--m3-outline-variant, #e3e8ee)" }
                    }
                  >
                    <input
                      type="radio"
                      value="ok"
                      checked={reportType === "ok"}
                      onChange={() => setReportType("ok")}
                      className="accent-m3-success-container"
                    />
                    <div>
                      <p className="text-sm font-medium text-m3-on-success-container">
                        ✅ Đủ sức khỏe
                      </p>
                    </div>
                  </label>
                  <label
                    className="flex-1 flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer"
                    style={
                      reportType === "health_issue"
                        ? { borderColor: "var(--m3-error, #ba1a1a)", background: "var(--m3-error-container, var(--m3-error-container, #ffdad6))" }
                        : { borderColor: "var(--m3-outline-variant, #e3e8ee)" }
                    }
                  >
                    <input
                      type="radio"
                      value="health_issue"
                      checked={reportType === "health_issue"}
                      onChange={() => setReportType("health_issue")}
                      className="accent-m3-error-container"
                    />
                    <div>
                      <p className="text-sm font-medium text-m3-on-error-container">
                        ⚠️ SK không đảm bảo
                      </p>
                    </div>
                  </label>
                </div>
              </div>
              {reportType === "health_issue" && (
                <div>
                  <label className="text-sm font-medium text-m3-on-surface-variant block mb-1">
                    Mô tả *
                  </label>
                  <textarea
                    className="w-full border border-m3-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-m3-primary resize-none"
                    rows={3}
                    placeholder="Mô tả tình trạng sức khỏe..."
                    value={reportNote}
                    onChange={(e) => setReportNote(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 p-5 border-t border-m3-outline-variant">
              <button
                onClick={() => setReportModal(null)}
                className="flex-1 py-2.5 border border-m3-outline-variant text-m3-on-surface-variant hover:bg-m3-surface-high rounded-xl text-sm"
              >
                Hủy
              </button>
              <button
                onClick={() => handleReport(reportModal)}
                disabled={reportType === "health_issue" && !reportNote}
                className="flex-1 py-2.5 bg-m3-primary hover:bg-m3-on-surface-variant disabled:opacity-50 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
              >
                <Send size={14} /> Gửi báo cáo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page: picks correct view based on role ─────────────────────────────
export default function ReceivingUnitPage() {
  const [session, setSession] = useState<Session | null>(null);

  const fetchSession = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const d = await res.json();
      setSession(d.user);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  if (!session) {
    return (
      <div className="flex items-center justify-center h-48 text-m3-on-surface-variant text-sm">
        Đang tải...
      </div>
    );
  }

  return session.hierarchyLevel === "bo" ? <BoView /> : <DonViView />;
}
