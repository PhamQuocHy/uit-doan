"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  User2,
  Search,
  Filter,
  X,
  Send,
  Shield,
  Clock,
  Plus,
  Users,
} from "lucide-react";

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

function BoView() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [notePopover, setNotePopover] = useState<string | null>(null);

  const filtered = boMockUnits.filter((u) => {
    const matchSearch =
      !search || u.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || u.status === statusFilter;
    return matchSearch && matchStatus;
  });

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
          Đơn vị nhận quân
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--m3-primary, #1a73e8)" }}>
          Theo dõi tình trạng nhận quân của tất cả đơn vị
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Tổng đơn vị", value: boMockUnits.length, color: "var(--m3-on-surface, #1b1d20)" },
          { label: "Đã nhận đủ quân", value: confirmedCount, color: "var(--color-m3-success)" },
          { label: "Chờ xác nhận", value: pendingCount, color: "var(--color-m3-warning)" },
          { label: "Cần bổ sung", value: supplementCount, color: "var(--m3-error, #ba1a1a)" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-m3-surface-lowest rounded-2xl p-5 border border-m3-outline-variant shadow-sm"
          >
            <p className="text-xs text-m3-on-surface-variant">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>
      {/* Progress */}
      <div className="bg-m3-surface-lowest rounded-2xl p-5 border border-m3-outline-variant shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-m3-on-surface-variant">
            Tổng tiến độ nhận quân
          </p>
          <span className="text-sm font-bold" style={{ color: "var(--m3-primary, #1a73e8)" }}>
            {totalReceived}/{totalQuota} (
            {Math.round((totalReceived / totalQuota) * 100)}%)
          </span>
        </div>
        <div className="h-3 bg-m3-surface-container rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round((totalReceived / totalQuota) * 100)}%`,
              background: "var(--m3-primary, #1a73e8)",
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-m3-surface-lowest rounded-2xl shadow-sm border border-m3-outline-variant overflow-hidden">
        <div className="p-4 border-b border-m3-outline-variant flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
              size={16}
            />
            <input
              type="text"
              placeholder="Tìm đơn vị..."
              className="w-full pl-9 pr-4 py-2 border border-m3-outline-variant rounded-xl text-sm focus:outline-none focus:border-m3-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border border-m3-outline-variant rounded-xl text-sm focus:outline-none focus:border-m3-primary bg-m3-surface-lowest"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="confirmed">Đã nhận đủ</option>
            <option value="pending">Chờ xác nhận</option>
            <option value="supplement_needed">Cần bổ sung</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-m3-surface-high/50 text-m3-on-surface-variant font-medium border-b border-m3-outline-variant">
              <tr>
                <th className="px-6 py-4">Đơn vị nhận quân</th>
                <th className="px-6 py-4 text-center">Chỉ tiêu</th>
                <th className="px-6 py-4 text-center">Đã nhận</th>
                <th className="px-6 py-4">Tiến độ</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4">Cập nhật</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-m3-outline-variant">
              {filtered.map((u) => {
                const pct = Math.round((u.received / u.quota) * 100);
                const sc = statusConf[u.status];
                return (
                  <tr
                    key={u.id}
                    className={`transition-colors ${
                      u.status === "supplement_needed"
                        ? "bg-m3-error-container/50 hover:bg-m3-error-container/50"
                        : "hover:bg-m3-surface-high/50"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="relative shrink-0">
                          {u.status === "supplement_needed" ? (
                            <button
                              onClick={() =>
                                setNotePopover(
                                  notePopover === u.id ? null : u.id,
                                )
                              }
                              className="w-8 h-8 rounded-full flex items-center justify-center bg-m3-error-container hover:bg-m3-error-container ring-2 ring-m3-error transition-colors"
                              title="Xem lý do cần bổ sung"
                            >
                              <Shield size={13} className="text-m3-error" />
                              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-m3-error-container text-white text-[10px] font-bold flex items-center justify-center leading-none">
                                !
                              </span>
                            </button>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-m3-surface-high flex items-center justify-center">
                              <Shield size={13} style={{ color: "var(--m3-primary, #1a73e8)" }} />
                            </div>
                          )}
                          {notePopover === u.id && (
                            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                              <div className="bg-m3-surface-lowest rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                <div className="p-6">
                                  <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-m3-error-container flex items-center justify-center shrink-0">
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
                                      onClick={() => setNotePopover(null)}
                                      className="ml-auto p-2 hover:bg-m3-surface-container rounded-xl transition-colors text-m3-on-surface-variant"
                                    >
                                      <X size={20} />
                                    </button>
                                  </div>

                                  <div className="bg-m3-error-container/50 border border-m3-error rounded-2xl p-4 mb-6">
                                    <p className="text-sm text-m3-on-surface-variant leading-relaxed whitespace-pre-wrap">
                                      {u.note}
                                    </p>
                                  </div>

                                  <div className="border border-m3-outline-variant rounded-xl overflow-hidden mb-6">
                                    <table className="w-full text-left text-sm">
                                      <thead className="bg-m3-surface-high font-medium text-m3-on-surface-variant border-b border-m3-outline-variant">
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
                                                <div className="text-xs text-m3-on-surface-variant font-mono mt-0.5">
                                                  {soldier.cccd}
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 text-m3-on-surface-variant">
                                                {soldier.origin}
                                              </td>
                                              <td className="px-4 py-3 text-m3-on-error-container font-medium italic">
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
                                    onClick={() => setNotePopover(null)}
                                    className="w-full py-3 bg-m3-surface-highest hover:bg-black text-white rounded-2xl text-sm font-semibold transition-all shadow-lg active:scale-95"
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
                    <td className="px-6 py-4 text-center font-semibold text-m3-on-surface-variant">
                      {u.quota}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-m3-on-surface">
                      {u.received}
                    </td>
                    <td className="px-6 py-4 min-w-[130px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-m3-surface-container rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              background: pct >= 100 ? "var(--color-m3-success)" : "var(--m3-primary, #1a73e8)",
                            }}
                          />
                        </div>
                        <span className="text-xs text-m3-on-surface-variant w-7">
                          {pct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ background: sc.bg, color: sc.color }}
                      >
                        <sc.Icon size={11} /> {sc.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-m3-on-surface-variant">
                      {new Date(u.lastUpdate).toLocaleDateString("vi-VN")}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-m3-on-surface-variant"
                  >
                    Không có kết quả
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

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

  const filtered = soldiers.filter((s) => {
    const matchSearch =
      !search ||
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.cccd.includes(search);
    const matchArrival = !arrivalFilter || s.arrivalStatus === arrivalFilter;
    return matchSearch && matchArrival;
  });

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--m3-on-surface, #1b1d20)" }}>
            Đơn vị nhận quân
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m3-primary, #1a73e8)" }}>
            Xác nhận danh sách nhận quân và báo cáo tình trạng sức khỏe
          </p>
        </div>
        {!confirmAll ? (
          <button
            onClick={handleConfirmAll}
            className="flex items-center gap-2 px-4 py-2 bg-m3-success-container hover:bg-m3-success-container text-white rounded-xl text-sm font-medium transition-colors"
          >
            <CheckCircle2 size={16} /> Xác nhận đủ quân
          </button>
        ) : (
          <span className="flex items-center gap-2 px-4 py-2 bg-m3-success-container text-m3-on-success-container border border-m3-success rounded-xl text-sm font-medium">
            <CheckCircle2 size={16} /> Đã xác nhận đủ quân
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Tổng quân nhân", value: soldiers.length, color: "var(--m3-on-surface, #1b1d20)" },
          { label: "Đã trình diện", value: arrivedCount, color: "var(--color-m3-success)" },
          { label: "Báo cáo đủ SK", value: confirmedOk, color: "var(--m3-primary, #1a73e8)" },
          {
            label: "SK không đảm bảo",
            value: reportedIssues,
            color: "var(--m3-error, #ba1a1a)",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-m3-surface-lowest rounded-2xl p-5 border border-m3-outline-variant shadow-sm"
          >
            <p className="text-xs text-m3-on-surface-variant">{s.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-m3-surface-lowest rounded-2xl p-5 border border-m3-outline-variant shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-m3-on-surface-variant">Tiến độ nhận quân</p>
          <span className="text-sm font-bold" style={{ color: "var(--m3-primary, #1a73e8)" }}>
            {arrivedCount}/{soldiers.length} (
            {Math.round((arrivedCount / soldiers.length) * 100)}%)
          </span>
        </div>
        <div className="h-3 bg-m3-surface-container rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round((arrivedCount / soldiers.length) * 100)}%`,
              background: "var(--m3-primary, #1a73e8)",
            }}
          />
        </div>
      </div>

      <div className="bg-m3-surface-lowest rounded-2xl shadow-sm border border-m3-outline-variant overflow-hidden">
        <div className="p-4 border-b border-m3-outline-variant flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
              size={16}
            />
            <input
              type="text"
              placeholder="Tìm họ tên, CCCD..."
              className="w-full pl-9 pr-4 py-2 border border-m3-outline-variant rounded-xl text-sm focus:outline-none focus:border-m3-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
              size={15}
            />
            <select
              className="pl-9 pr-8 py-2 border border-m3-outline-variant rounded-xl text-sm appearance-none focus:outline-none focus:border-m3-primary bg-m3-surface-lowest"
              value={arrivalFilter}
              onChange={(e) => setArrivalFilter(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="arrived">Đã trình diện</option>
              <option value="pending">Chưa lên</option>
              <option value="absent">Vắng mặt</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-m3-surface-high/50 text-m3-on-surface-variant font-medium border-b border-m3-outline-variant">
              <tr>
                <th className="px-5 py-3">Quân nhân</th>
                <th className="px-5 py-3">Quê quán</th>
                <th className="px-5 py-3 text-center">Phân loại SK</th>
                <th className="px-5 py-3">Trình diện</th>
                <th className="px-5 py-3">Báo cáo</th>
                <th className="px-5 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-m3-outline-variant">
              {filtered.map((s) => {
                const ac = arrivalConfig[s.arrivalStatus];
                return (
                  <tr
                    key={s.id}
                    className="hover:bg-m3-surface-high/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-m3-surface-high flex items-center justify-center shrink-0">
                          <User2 size={12} style={{ color: "var(--m3-primary, #1a73e8)" }} />
                        </div>
                        <div>
                          <div className="font-medium text-m3-on-surface text-sm">
                            {s.fullName}
                          </div>
                          <div className="text-xs text-m3-on-surface-variant font-mono">
                            {s.cccd}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-m3-on-surface-variant max-w-[160px]">
                      {s.origin}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-bold"
                        style={{ background: "var(--m3-primary-container, #dae9fb)", color: "var(--m3-primary, #1a73e8)" }}
                      >
                        {s.healthClass}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ background: ac.bg, color: ac.color }}
                      >
                        {ac.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {s.unitReport === "ok" && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                          style={{ background: "var(--color-m3-success-container)", color: "var(--color-m3-success)" }}
                        >
                          <CheckCircle2 size={11} /> Đủ SK
                        </span>
                      )}
                      {s.unitReport === "health_issue" && (
                        <div>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                            style={{ background: "var(--m3-error-container, var(--m3-error-container, #ffdad6))", color: "var(--m3-error, #ba1a1a)" }}
                          >
                            <AlertTriangle size={11} /> SK không đảm bảo
                          </span>
                          {s.reportNote && (
                            <p className="text-xs text-m3-on-surface-variant mt-0.5 italic">
                              {s.reportNote}
                            </p>
                          )}
                        </div>
                      )}
                      {!s.unitReport && (
                        <span className="text-xs text-m3-on-surface-variant">
                          Chưa báo cáo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {s.arrivalStatus === "arrived" && !s.unitReport ? (
                        <button
                          onClick={() => {
                            setReportModal(s);
                            setReportType("health_issue");
                            setReportNote("");
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-m3-primary hover:bg-m3-on-surface-variant rounded-lg transition-colors flex items-center gap-1 mx-auto"
                        >
                          <Send size={12} /> Báo cáo
                        </button>
                      ) : (
                        <span className="text-xs text-m3-on-surface-variant italic">
                          {s.unitReport ? "Đã BÁO" : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-m3-on-surface-variant"
                  >
                    Không có kết quả
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-m3-surface-lowest rounded-2xl shadow-xl w-full max-w-md">
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
