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
  arrived: { label: "Đã trình diện", color: "#059669", bg: "#d1fae5" },
  pending: { label: "Chưa lên", color: "#d97706", bg: "#fef3c7" },
  absent: { label: "Vắng mặt", color: "#dc2626", bg: "#fee2e2" },
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
      color: "#059669",
      bg: "#d1fae5",
      Icon: CheckCircle2,
    },
    pending: {
      label: "Ch\u1edd x\u00e1c nh\u1eadn",
      color: "#d97706",
      bg: "#fef3c7",
      Icon: Clock,
    },
    supplement_needed: {
      label: "C\u1ea7n b\u1ed5 sung",
      color: "#dc2626",
      bg: "#fee2e2",
      Icon: AlertTriangle,
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#3b491e" }}>
          Đơn vị nhận quân
        </h1>
        <p className="text-sm mt-1" style={{ color: "#748c2c" }}>
          Theo dõi tình trạng nhận quân của tất cả đơn vị
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Tổng đơn vị", value: boMockUnits.length, color: "#3b491e" },
          { label: "Đã nhận đủ quân", value: confirmedCount, color: "#059669" },
          { label: "Chờ xác nhận", value: pendingCount, color: "#d97706" },
          { label: "Cần bổ sung", value: supplementCount, color: "#dc2626" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl p-5 border border-[#edf4dc] shadow-sm"
          >
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>
      {/* Progress */}
      <div className="bg-white rounded-2xl p-5 border border-[#edf4dc] shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">
            Tổng tiến độ nhận quân
          </p>
          <span className="text-sm font-bold" style={{ color: "#748c2c" }}>
            {totalReceived}/{totalQuota} (
            {Math.round((totalReceived / totalQuota) * 100)}%)
          </span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round((totalReceived / totalQuota) * 100)}%`,
              background: "#748c2c",
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#edf4dc] overflow-hidden">
        <div className="p-4 border-b border-[#edf4dc] flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Tìm đơn vị..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#748c2c]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#748c2c] bg-white"
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
            <thead className="bg-[#f8fae8]/50 text-[#586c23] font-medium border-b border-[#edf4dc]">
              <tr>
                <th className="px-6 py-4">Đơn vị nhận quân</th>
                <th className="px-6 py-4 text-center">Chỉ tiêu</th>
                <th className="px-6 py-4 text-center">Đã nhận</th>
                <th className="px-6 py-4">Tiến độ</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4">Cập nhật</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => {
                const pct = Math.round((u.received / u.quota) * 100);
                const sc = statusConf[u.status];
                return (
                  <tr
                    key={u.id}
                    className={`transition-colors ${
                      u.status === "supplement_needed"
                        ? "bg-red-50/50 hover:bg-red-100/50"
                        : "hover:bg-gray-50/50"
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
                              className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100 hover:bg-red-200 ring-2 ring-red-400 transition-colors"
                              title="Xem lý do cần bổ sung"
                            >
                              <Shield size={13} className="text-red-500" />
                              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                                !
                              </span>
                            </button>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#f8fae8] flex items-center justify-center">
                              <Shield size={13} style={{ color: "#748c2c" }} />
                            </div>
                          )}
                          {notePopover === u.id && (
                            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                <div className="p-6">
                                  <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center shrink-0">
                                      <AlertTriangle
                                        size={24}
                                        className="text-red-500"
                                      />
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-bold text-gray-900">
                                        Chi tiết lý do bổ sung
                                      </h3>
                                      <p className="text-sm text-gray-500">
                                        {u.name}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => setNotePopover(null)}
                                      className="ml-auto p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"
                                    >
                                      <X size={20} />
                                    </button>
                                  </div>

                                  <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 mb-6">
                                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                      {u.note}
                                    </p>
                                  </div>

                                  <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
                                    <table className="w-full text-left text-sm">
                                      <thead className="bg-gray-50 font-medium text-gray-600 border-b border-gray-200">
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
                                      <tbody className="divide-y divide-gray-100">
                                        {mockUnqualifiedSoldiers
                                          .filter(
                                            (s) => s.unitReceived === u.name,
                                          )
                                          .map((soldier) => (
                                            <tr
                                              key={soldier.id}
                                              className="hover:bg-gray-50"
                                            >
                                              <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">
                                                  {soldier.fullName}
                                                </div>
                                                <div className="text-xs text-gray-500 font-mono mt-0.5">
                                                  {soldier.cccd}
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 text-gray-600">
                                                {soldier.origin}
                                              </td>
                                              <td className="px-4 py-3 text-red-600 font-medium italic">
                                                {soldier.reason}
                                              </td>
                                              <td className="px-4 py-3 text-center text-gray-500">
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
                                              className="px-4 py-6 text-center text-gray-400"
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
                                    className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-2xl text-sm font-semibold transition-all shadow-lg active:scale-95"
                                  >
                                    Đã hiểu
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-gray-900">
                          {u.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-gray-700">
                      {u.quota}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-gray-900">
                      {u.received}
                    </td>
                    <td className="px-6 py-4 min-w-[130px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              background: pct >= 100 ? "#059669" : "#748c2c",
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-7">
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
                    <td className="px-6 py-4 text-xs text-gray-400">
                      {new Date(u.lastUpdate).toLocaleDateString("vi-VN")}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-gray-400"
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
          <h1 className="text-2xl font-bold" style={{ color: "#3b491e" }}>
            Đơn vị nhận quân
          </h1>
          <p className="text-sm mt-1" style={{ color: "#748c2c" }}>
            Xác nhận danh sách nhận quân và báo cáo tình trạng sức khỏe
          </p>
        </div>
        {!confirmAll ? (
          <button
            onClick={handleConfirmAll}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <CheckCircle2 size={16} /> Xác nhận đủ quân
          </button>
        ) : (
          <span className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-xl text-sm font-medium">
            <CheckCircle2 size={16} /> Đã xác nhận đủ quân
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Tổng quân nhân", value: soldiers.length, color: "#3b491e" },
          { label: "Đã trình diện", value: arrivedCount, color: "#059669" },
          { label: "Báo cáo đủ SK", value: confirmedOk, color: "#2563eb" },
          {
            label: "SK không đảm bảo",
            value: reportedIssues,
            color: "#dc2626",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl p-5 border border-[#edf4dc] shadow-sm"
          >
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-5 border border-[#edf4dc] shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">Tiến độ nhận quân</p>
          <span className="text-sm font-bold" style={{ color: "#748c2c" }}>
            {arrivedCount}/{soldiers.length} (
            {Math.round((arrivedCount / soldiers.length) * 100)}%)
          </span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round((arrivedCount / soldiers.length) * 100)}%`,
              background: "#748c2c",
            }}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#edf4dc] overflow-hidden">
        <div className="p-4 border-b border-[#edf4dc] flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Tìm họ tên, CCCD..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#748c2c]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={15}
            />
            <select
              className="pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm appearance-none focus:outline-none focus:border-[#748c2c] bg-white"
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
            <thead className="bg-[#f8fae8]/50 text-[#586c23] font-medium border-b border-[#edf4dc]">
              <tr>
                <th className="px-5 py-3">Quân nhân</th>
                <th className="px-5 py-3">Quê quán</th>
                <th className="px-5 py-3 text-center">Phân loại SK</th>
                <th className="px-5 py-3">Trình diện</th>
                <th className="px-5 py-3">Báo cáo</th>
                <th className="px-5 py-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((s) => {
                const ac = arrivalConfig[s.arrivalStatus];
                return (
                  <tr
                    key={s.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#f8fae8] flex items-center justify-center shrink-0">
                          <User2 size={12} style={{ color: "#748c2c" }} />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">
                            {s.fullName}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">
                            {s.cccd}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500 max-w-[160px]">
                      {s.origin}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-bold"
                        style={{ background: "#dbeafe", color: "#2563eb" }}
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
                          style={{ background: "#d1fae5", color: "#059669" }}
                        >
                          <CheckCircle2 size={11} /> Đủ SK
                        </span>
                      )}
                      {s.unitReport === "health_issue" && (
                        <div>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                            style={{ background: "#fee2e2", color: "#dc2626" }}
                          >
                            <AlertTriangle size={11} /> SK không đảm bảo
                          </span>
                          {s.reportNote && (
                            <p className="text-xs text-gray-400 mt-0.5 italic">
                              {s.reportNote}
                            </p>
                          )}
                        </div>
                      )}
                      {!s.unitReport && (
                        <span className="text-xs text-gray-400">
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
                          className="px-3 py-1.5 text-xs font-medium text-white bg-[#748c2c] hover:bg-[#586c23] rounded-lg transition-colors flex items-center gap-1 mx-auto"
                        >
                          <Send size={12} /> Báo cáo
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 italic">
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
                    className="px-5 py-8 text-center text-gray-400"
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                Báo cáo tình trạng quân nhân
              </h2>
              <button
                onClick={() => setReportModal(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-[#f8fae8] flex items-center justify-center">
                  <Shield size={13} style={{ color: "#748c2c" }} />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {reportModal.fullName}
                  </p>
                  <p className="text-xs text-gray-400 font-mono">
                    {reportModal.cccd}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Kết quả *
                </label>
                <div className="flex gap-3">
                  <label
                    className="flex-1 flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer"
                    style={
                      reportType === "ok"
                        ? { borderColor: "#059669", background: "#f0fdf4" }
                        : { borderColor: "#e5e7eb" }
                    }
                  >
                    <input
                      type="radio"
                      value="ok"
                      checked={reportType === "ok"}
                      onChange={() => setReportType("ok")}
                      className="accent-green-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-green-700">
                        ✅ Đủ sức khỏe
                      </p>
                    </div>
                  </label>
                  <label
                    className="flex-1 flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer"
                    style={
                      reportType === "health_issue"
                        ? { borderColor: "#dc2626", background: "#fff5f5" }
                        : { borderColor: "#e5e7eb" }
                    }
                  >
                    <input
                      type="radio"
                      value="health_issue"
                      checked={reportType === "health_issue"}
                      onChange={() => setReportType("health_issue")}
                      className="accent-red-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-red-700">
                        ⚠️ SK không đảm bảo
                      </p>
                    </div>
                  </label>
                </div>
              </div>
              {reportType === "health_issue" && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Mô tả *
                  </label>
                  <textarea
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#748c2c] resize-none"
                    rows={3}
                    placeholder="Mô tả tình trạng sức khỏe..."
                    value={reportNote}
                    onChange={(e) => setReportNote(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 p-5 border-t border-gray-100">
              <button
                onClick={() => setReportModal(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm"
              >
                Hủy
              </button>
              <button
                onClick={() => handleReport(reportModal)}
                disabled={reportType === "health_issue" && !reportNote}
                className="flex-1 py-2.5 bg-[#748c2c] hover:bg-[#586c23] disabled:opacity-50 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
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
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Đang tải...
      </div>
    );
  }

  return session.hierarchyLevel === "bo" ? <BoView /> : <DonViView />;
}
