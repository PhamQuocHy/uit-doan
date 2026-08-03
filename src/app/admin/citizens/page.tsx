"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { Citizen, HierarchyUnit } from "@/lib/data";
import { Search, Plus, Eye, Pencil, Trash2 } from "lucide-react";
import CitizenDetailModal from "@/components/admin/CitizenDetailModal";
import CitizenFormModal from "@/components/admin/CitizenFormModal";

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "chuakham", label: "Chưa khám" },
  { value: "dangkham", label: "Đang khám" },
  { value: "trungtuyen", label: "Đậu" },
  { value: "truottuyen", label: "Rớt" },
  { value: "tamhoan", label: "Tạm hoãn" },
  { value: "miengoi", label: "Miễn gọi" },
  { value: "nhapngu", label: "Nhập ngũ" },
] as const;

const SELECT_CLS =
  "h-10 min-w-0 rounded-[10px] border-0 bg-[#f5f5f7] px-3 pr-8 text-[14px] font-medium text-[#1d1d1f] outline-none transition-colors focus:bg-white focus:ring-2 focus:ring-[#007aff]/15";

type ScopeMeta = {
  code: string;
  name: string;
  level: string;
} | null;

export default function CitizensPage() {
  const searchParams = useSearchParams();
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [militaryStatusFilter, setMilitaryStatusFilter] = useState("");
  const [viewCitizen, setViewCitizen] = useState<Citizen | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editCitizen, setEditCitizen] = useState<Citizen | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sessionLevel, setSessionLevel] = useState<string | null>(null);
  const [sessionUnitCode, setSessionUnitCode] = useState<string | null>(null);
  const [filterTinh, setFilterTinh] = useState("");
  const [filterXa, setFilterXa] = useState("");
  const [provinces, setProvinces] = useState<HierarchyUnit[]>([]);
  const [wards, setWards] = useState<HierarchyUnit[]>([]);
  const [scopeMeta, setScopeMeta] = useState<ScopeMeta>(null);
  const [requiresUnitSelection, setRequiresUnitSelection] = useState(false);

  const effectiveUnitCode =
    sessionLevel === "bo"
      ? filterXa || filterTinh
      : sessionLevel === "tinh"
        ? filterXa || filterTinh || sessionUnitCode || ""
        : sessionUnitCode || "";

  const loadWards = useCallback(async (parentCode: string) => {
    if (!parentCode) {
      setWards([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/hierarchy/children?parentCode=${encodeURIComponent(parentCode)}`,
      );
      if (!res.ok) throw new Error("wards failed");
      const data = await res.json();
      setWards(data.items || []);
    } catch {
      setWards([]);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data) => {
        const level = data?.user?.hierarchyLevel ?? null;
        const unitCode = data?.user?.unitCode ?? null;
        setSessionLevel(level);
        setSessionUnitCode(unitCode);

        const scopeFromUrl = searchParams.get("scope");

        if (level === "bo") {
          const res = await fetch("/api/admin/hierarchy/children?parentCode=bo");
          const provData = res.ok ? await res.json() : { items: [] };
          setProvinces(provData.items || []);

          if (scopeFromUrl) {
            const unit = (provData.items || []).find(
              (p: HierarchyUnit) => p.code === scopeFromUrl,
            );
            if (unit) {
              setFilterTinh(scopeFromUrl);
              await loadWards(scopeFromUrl);
            } else {
              setFilterTinh(scopeFromUrl);
              await loadWards(scopeFromUrl);
            }
          }
        } else if (level === "tinh" && unitCode) {
          setFilterTinh(unitCode);
          await loadWards(unitCode);
          if (scopeFromUrl && scopeFromUrl.startsWith(`${unitCode}-`)) {
            setFilterXa(scopeFromUrl);
          }
        }
      })
      .catch(() => {
        setSessionLevel(null);
        setSessionUnitCode(null);
      });
  }, [searchParams, loadWards]);

  const fetchCitizens = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...(search && { search }),
        ...(militaryStatusFilter && { militaryStatus: militaryStatusFilter }),
        ...(effectiveUnitCode && { unitCode: effectiveUnitCode }),
      });
      const res = await fetch(`/api/admin/citizens?${query.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCitizens(data.data);
      setTotalPages(data.totalPages);
      setTotalCount(data.total ?? 0);
      setScopeMeta(data.meta?.scopeUnit ?? null);
      setRequiresUnitSelection(Boolean(data.meta?.requiresUnitSelection));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = searchParams.get("search");
    if (q) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    if (sessionLevel === null) return;
    fetchCitizens();
  }, [page, search, militaryStatusFilter, effectiveUnitCode, sessionLevel]);

  const handleTinhChange = (code: string) => {
    setFilterTinh(code);
    setFilterXa("");
    setPage(1);
    loadWards(code);
  };

  const handleXaChange = (code: string) => {
    setFilterXa(code);
    setPage(1);
  };

  const openCreate = () => {
    setFormMode("create");
    setEditCitizen(null);
    setFormOpen(true);
  };

  const openEdit = (citizen: Citizen) => {
    setFormMode("edit");
    setEditCitizen(citizen);
    setFormOpen(true);
  };

  const handleDelete = async (citizen: Citizen) => {
    const ok = window.confirm(
      `Xóa công dân "${citizen.fullName}"?\nThao tác này không hoàn lại được.`,
    );
    if (!ok) return;
    setBusyId(citizen.id);
    try {
      const res = await fetch(`/api/admin/citizens/${citizen.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Không xóa được. Cần tài khoản quản trị.");
        return;
      }
      await fetchCitizens();
    } catch {
      alert("Lỗi kết nối khi xóa");
    } finally {
      setBusyId(null);
    }
  };

  const getMilitaryStatusLabel = (status: string) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      chuakham: { label: "Chưa khám", color: "#636366", bg: "#f5f5f7" },
      dangkham: { label: "Đang khám", color: "#c93400", bg: "rgba(255,149,0,0.14)" },
      trungtuyen: { label: "Đậu", color: "#248a3d", bg: "rgba(52,199,89,0.14)" },
      truottuyen: { label: "Rớt", color: "#ff3b30", bg: "rgba(255,59,48,0.1)" },
      tamhoan: { label: "Tạm hoãn", color: "#007aff", bg: "rgba(0,122,255,0.12)" },
      miengoi: { label: "Miễn gọi", color: "#8944ab", bg: "rgba(175,82,222,0.12)" },
      nhapngu: { label: "Nhập ngũ", color: "#ff3b30", bg: "rgba(255,59,48,0.1)" },
    };
    return map[status] || { label: status, color: "#636366", bg: "#f5f5f7" };
  };

  const getHealthStyle = (grade?: string) => {
    if (!grade) return { bg: "#f5f5f7", color: "#636366" };
    if (["Loại 1", "Loại 2", "Loại 3"].includes(grade)) {
      return { bg: "rgba(52,199,89,0.14)", color: "#248a3d" };
    }
    if (grade === "Loại 4") {
      return { bg: "rgba(255,149,0,0.14)", color: "#c93400" };
    }
    return { bg: "rgba(255,59,48,0.1)", color: "#ff3b30" };
  };

  const TABLE_COLS = 9;

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-col gap-4 px-7 pt-7 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight text-[#1d1d1f]">
            Quản lý hồ sơ công dân
          </h1>
          {!requiresUnitSelection && scopeMeta && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(0,122,255,0.1)] px-3 py-1 text-[13px] font-semibold text-[#007aff]">
                {scopeMeta.name}
              </span>
              <span className="text-[14px] font-medium text-[#6e6e73]">
                {totalCount.toLocaleString("vi-VN")} hồ sơ
              </span>
            </div>
          )}
          {requiresUnitSelection && (
            <p className="mt-1.5 text-[14px] text-[#6e6e73]">
              Chọn địa phương bên dưới để tra cứu hồ sơ trong phạm vi quản lý.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#007aff] px-5 text-[15px] font-bold text-white transition-colors hover:bg-[#0066d6]"
        >
          <Plus size={18} />
          Thêm công dân
        </button>
      </div>

      <div className="px-7">
        <div className="rounded-[18px] border border-black/[0.06] bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            {(sessionLevel === "bo" || sessionLevel === "tinh") && (
              <div className="flex min-w-0 flex-wrap items-center gap-2 xl:shrink-0">
                {sessionLevel === "bo" && (
                  <select
                    className={`${SELECT_CLS} w-full sm:w-[200px]`}
                    value={filterTinh}
                    onChange={(e) => handleTinhChange(e.target.value)}
                    aria-label="Chọn tỉnh thành phố"
                  >
                    <option value="">Tỉnh / Thành phố</option>
                    {provinces.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
                {filterTinh && (
                  <select
                    className={`${SELECT_CLS} w-full sm:w-[180px]`}
                    value={filterXa}
                    onChange={(e) => handleXaChange(e.target.value)}
                    aria-label="Chọn xã phường"
                  >
                    <option value="">Tất cả xã / phường</option>
                    {wards.map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                )}
                <div className="hidden h-8 w-px bg-black/[0.08] xl:block" aria-hidden />
              </div>
            )}

            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8e8e93]"
                size={17}
              />
              <input
                type="text"
                placeholder="Tìm theo tên, CCCD, SĐT..."
                className="h-10 w-full rounded-[10px] border-0 bg-[#f5f5f7] py-2 pl-10 pr-4 text-[14px] text-[#1d1d1f] outline-none transition-colors placeholder:text-[#8e8e93] focus:bg-white focus:ring-2 focus:ring-[#007aff]/15"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <select
              className={`${SELECT_CLS} w-full xl:w-[168px] xl:shrink-0`}
              value={militaryStatusFilter}
              onChange={(e) => {
                setMilitaryStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Lọc trạng thái NVQS"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="macos-card mx-7 overflow-hidden">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left">
            <thead className="bg-[#f5f5f7] text-[13px] font-bold uppercase tracking-wide text-[#6e6e73]">
              <tr>
                <th className="px-5 py-4">Họ và tên</th>
                <th className="px-5 py-4">Ngày sinh</th>
                <th className="px-5 py-4">CCCD</th>
                <th className="hidden px-5 py-4 lg:table-cell">Học vấn</th>
                <th className="hidden px-5 py-4 md:table-cell min-w-[160px]">Địa chỉ</th>
                <th className="hidden px-5 py-4 sm:table-cell">Sức khỏe</th>
                <th className="px-5 py-4">Trạng thái</th>
                <th className="hidden px-5 py-4 xl:table-cell">Ghi chú</th>
                <th className="w-0 p-0" aria-hidden />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={TABLE_COLS} className="px-5 py-10 text-center text-[15px] text-[#6e6e73]">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : citizens.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLS} className="px-5 py-10 text-center text-[15px] text-[#6e6e73]">
                    {requiresUnitSelection
                      ? "Chọn tỉnh / thành phố ở trên để xem hồ sơ công dân theo địa phương."
                      : 'Không tìm thấy công dân. Bấm "Thêm công dân" để tạo mới.'}
                  </td>
                </tr>
              ) : (
                citizens.map((citizen) => {
                  const statusInfo = getMilitaryStatusLabel(citizen.militaryStatus);
                  const healthStyle = getHealthStyle(citizen.healthStatus);
                  return (
                    <tr key={citizen.id} className="group relative hover:bg-[#f5f5f7]/70">
                      <td className="px-5 py-4">
                        <div className="text-[16px] font-bold text-[#1d1d1f]">
                          {citizen.fullName}
                        </div>
                        <div className="mt-0.5 text-[13px] text-[#6e6e73]">
                          {citizen.gender === "male" ? "Nam" : "Nữ"} · {citizen.phone || "—"}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[15px] text-[#3a3a3c]">
                        {new Date(citizen.dateOfBirth).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-5 py-4 font-mono text-[14px] font-semibold text-[#1d1d1f]">
                        {citizen.cccd}
                      </td>
                      <td className="hidden px-5 py-4 lg:table-cell">
                        <div className="text-[15px] font-semibold text-[#1d1d1f]">
                          {citizen.educationLevel}
                        </div>
                        <div className="text-[13px] text-[#6e6e73]">{citizen.job || "—"}</div>
                      </td>
                      <td className="hidden px-5 py-4 md:table-cell">
                        <CellTruncate text={citizen.address} maxW="max-w-none" />
                      </td>
                      <td className="hidden px-5 py-4 sm:table-cell">
                        {citizen.healthStatus ? (
                          <span
                            className="inline-flex rounded-[10px] px-2.5 py-1 text-[13px] font-bold"
                            style={{
                              backgroundColor: healthStyle.bg,
                              color: healthStyle.color,
                            }}
                          >
                            {citizen.healthStatus}
                          </span>
                        ) : (
                          <span className="text-[14px] text-[#8e8e93]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="inline-flex rounded-[10px] px-3 py-1.5 text-[13px] font-bold"
                          style={{
                            backgroundColor: statusInfo.bg,
                            color: statusInfo.color,
                          }}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="hidden px-5 py-4 xl:table-cell">
                        <CellTruncate
                          text={citizen.militaryStatusReason}
                          maxW="max-w-none"
                          muted={!citizen.militaryStatusReason}
                        />
                      </td>
                      <td className="relative w-0 border-0 p-0">
                        <div className="pointer-events-none absolute right-4 top-1/2 z-10 flex -translate-y-1/2 items-center gap-2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 max-sm:pointer-events-auto max-sm:relative max-sm:right-auto max-sm:top-auto max-sm:translate-y-0 max-sm:px-5 max-sm:py-4 max-sm:opacity-100">
                          <div className="flex items-center gap-2 rounded-[14px] bg-white/95 px-2 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] backdrop-blur-sm max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none max-sm:ring-0">
                          <ActionBtn
                            label="Xem"
                            tone="gray"
                            icon={<Eye size={16} />}
                            onClick={() => setViewCitizen(citizen)}
                          />
                          <ActionBtn
                            label="Sửa"
                            tone="blue"
                            icon={<Pencil size={16} />}
                            onClick={() => openEdit(citizen)}
                          />
                          <ActionBtn
                            label="Xóa"
                            tone="red"
                            icon={<Trash2 size={16} />}
                            disabled={busyId === citizen.id}
                            onClick={() => handleDelete(citizen)}
                          />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-black/[0.05] px-5 py-4 text-[15px]">
            <span className="font-medium text-[#6e6e73]">
              Trang {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="min-h-[44px] rounded-[12px] border border-black/[0.08] px-4 font-bold text-[#1d1d1f] disabled:opacity-40"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="min-h-[44px] rounded-[12px] border border-black/[0.08] px-4 font-bold text-[#1d1d1f] disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      <CitizenDetailModal
        citizen={viewCitizen}
        onClose={() => setViewCitizen(null)}
        onEdit={openEdit}
        onCitizenUpdated={(updated) => {
          setViewCitizen(updated);
          setCitizens((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c)),
          );
        }}
      />
      <CitizenFormModal
        open={formOpen}
        mode={formMode}
        citizen={editCitizen}
        onClose={() => setFormOpen(false)}
        onSaved={fetchCitizens}
      />
    </div>
  );
}

function CellTruncate({
  text,
  maxW = "max-w-[180px]",
  muted,
}: {
  text?: string | null;
  maxW?: string;
  muted?: boolean;
}) {
  if (!text) {
    return <span className="text-[14px] text-[#8e8e93]">—</span>;
  }
  return (
    <span
      className={`block truncate text-[14px] ${maxW} ${muted ? "text-[#8e8e93]" : "text-[#3a3a3c]"}`}
      title={text}
    >
      {text}
    </span>
  );
}

function ActionBtn({
  label,
  icon,
  onClick,
  tone,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  tone: "gray" | "blue" | "red";
  disabled?: boolean;
}) {
  const styles = {
    gray: "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]",
    blue: "bg-[rgba(0,122,255,0.12)] text-[#007aff] hover:bg-[rgba(0,122,255,0.18)]",
    red: "bg-[rgba(255,59,48,0.1)] text-[#ff3b30] hover:bg-[rgba(255,59,48,0.16)]",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-[12px] px-3 text-[14px] font-bold transition-colors disabled:opacity-50 ${styles[tone]}`}
    >
      {icon}
      {label}
    </button>
  );
}
