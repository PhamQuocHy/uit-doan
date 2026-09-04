"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { Citizen, HierarchyUnit } from "@/lib/data";
import { Search, Plus, Eye, Pencil, Trash2, SlidersHorizontal, CalendarDays, CheckSquare, MapPinned, X } from "lucide-react";
import CitizenDetailModal from "@/components/admin/CitizenDetailModal";
import CitizenFormModal from "@/components/admin/CitizenFormModal";
import { getCallDisplayLabel } from "@/lib/enlistment-approval";

const CALL_FILTER_OPTIONS = [
  { value: "", label: "Tất cả dự kiến" },
  { value: "du_kien_goi", label: "Dự kiến gọi" },
  { value: "khong_goi", label: "Không gọi" },
  { value: "unset", label: "Chưa xác định" },
] as const;

const SELECT_CLS =
  "h-10 min-w-0 rounded-[10px] border-0 bg-m3-surface-high px-3 pr-8 text-[14px] font-medium text-m3-on-surface outline-none transition-colors focus:bg-m3-surface-lowest focus:ring-2 focus:ring-m3-primary/15";

type ScopeMeta = {
  code: string;
  name: string;
  level: string;
} | null;

type CampaignOption = {
  id: string;
  name: string;
  year: number;
  startDate: string;
};

export default function CitizensPage() {
  const searchParams = useSearchParams();
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [callIntentFilter, setCallIntentFilter] = useState("");
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
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftCampaignId, setDraftCampaignId] = useState("");
  const [draftCallIntent, setDraftCallIntent] = useState("");
  const [filterTab, setFilterTab] = useState<"campaign" | "status" | "location">("campaign");

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
        ...(callIntentFilter && { callIntent: callIntentFilter }),
        ...(campaignId && { campaignId }),
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
  }, [page, search, callIntentFilter, campaignId, effectiveUnitCode, sessionLevel]);

  useEffect(() => {
    fetch("/api/admin/recruitment?limit=100")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((data) => {
        const sorted = [...(data.data || [])].sort(
          (a: CampaignOption, b: CampaignOption) =>
            b.year - a.year || String(b.startDate).localeCompare(String(a.startDate)),
        );
        setCampaigns(sorted);
          if (sorted[0]) setCampaignId((current) => current || sorted[0].id);
      })
      .catch(() => undefined);
        }, [campaignId]);

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

  const openFilters = () => {
    setDraftCampaignId(campaignId);
    setDraftCallIntent(callIntentFilter);
    setFilterTab("campaign");
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setCampaignId(draftCampaignId);
    setCallIntentFilter(draftCallIntent);
    setPage(1);
    setFilterOpen(false);
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

  const getCallLabel = (citizen: Citizen) => getCallDisplayLabel(citizen);

  const getHealthStyle = (grade?: string) => {
    if (!grade) return { bg: "var(--m3-surface-container-high, #eef1f4)", color: "var(--m3-on-surface-variant, #475569)" };
    if (["Loại 1", "Loại 2", "Loại 3"].includes(grade)) {
      return { bg: "color-mix(in srgb, var(--color-m3-success) 14%, transparent)", color: "var(--color-m3-success)" };
    }
    if (grade === "Loại 4") {
      return { bg: "color-mix(in srgb, var(--color-m3-warning) 14%, transparent)", color: "var(--m3-error, #ba1a1a)" };
    }
    return { bg: "color-mix(in srgb, var(--m3-error, #ba1a1a) 10%, transparent)", color: "var(--m3-error, #ba1a1a)" };
  };

  const TABLE_COLS = 9;

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight text-m3-on-surface">
            Quản lý hồ sơ công dân
          </h1>
          {!requiresUnitSelection && scopeMeta && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-m3-primary/10 px-3 py-1 text-[13px] font-semibold text-m3-primary">
                {scopeMeta.name}
              </span>
              <span className="text-[14px] font-medium text-m3-on-surface-variant">
                {totalCount.toLocaleString("vi-VN")} hồ sơ
              </span>
            </div>
          )}
          {requiresUnitSelection && (
            <p className="mt-1.5 text-[14px] text-m3-on-surface-variant">
              Chọn địa phương bên dưới để tra cứu hồ sơ trong phạm vi quản lý.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-m3-primary px-5 text-[15px] font-bold text-white transition-colors hover:bg-m3-primary"
        >
          <Plus size={18} />
          Thêm công dân
        </button>
      </div>

      <div>
        <div className="rounded-[18px] border border-black/[0.06] bg-m3-surface-lowest p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
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
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
                size={17}
              />
              <input
                type="text"
                placeholder="Tìm theo tên, CCCD, SĐT..."
                className="h-10 w-full rounded-[10px] border-0 bg-m3-surface-high py-2 pl-10 pr-4 text-[14px] text-m3-on-surface outline-none transition-colors placeholder:text-m3-on-surface-variant focus:bg-m3-surface-lowest focus:ring-2 focus:ring-m3-primary/15"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <button
              type="button"
              onClick={openFilters}
              className={`${SELECT_CLS} inline-flex w-full items-center justify-center gap-2 xl:w-auto xl:shrink-0`}
              aria-label="Mở bộ lọc nâng cao"
            >
              <SlidersHorizontal size={16} />
              Bộ lọc
              {(callIntentFilter || campaignId) && <span className="rounded-full bg-m3-primary px-1.5 text-[11px] text-white">{Number(Boolean(callIntentFilter)) + Number(Boolean(campaignId))}</span>}
            </button>
          </div>
        </div>
      </div>

      {filterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setFilterOpen(false); }}>
          <div className="w-full max-w-[760px] overflow-hidden rounded-[22px] border border-m3-outline-variant bg-m3-surface-lowest shadow-2xl">
          <div className="flex items-center justify-between border-b border-m3-outline-variant px-5 py-4">
            <div className="flex items-center gap-2"><SlidersHorizontal size={20} className="text-m3-primary" /><h2 className="text-lg font-bold text-m3-on-surface">Bộ lọc nâng cao</h2></div>
            <button type="button" onClick={() => setFilterOpen(false)} className="rounded-lg p-2 text-m3-on-surface-variant hover:bg-m3-surface-container"><X size={19} /></button>
          </div>
          <div className="grid max-h-[calc(100vh-190px)] overflow-y-auto md:grid-cols-[220px_1fr] md:overflow-hidden">
            <div className="border-b border-m3-outline-variant bg-m3-surface-container-low p-4 md:border-b-0 md:border-r">
              <button type="button" onClick={() => setFilterTab("campaign")} className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 text-left text-[15px] font-semibold ${filterTab === "campaign" ? "bg-m3-primary-container text-m3-on-primary-container" : "text-m3-on-surface-variant hover:bg-m3-surface-container"}`}><CalendarDays size={19} /> Đợt khám tuyển</button>
              <button type="button" onClick={() => setFilterTab("status")} className={`mt-2 flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 text-left text-[15px] font-semibold ${filterTab === "status" ? "bg-m3-primary-container text-m3-on-primary-container" : "text-m3-on-surface-variant hover:bg-m3-surface-container"}`}><CheckSquare size={19} /> Trạng thái gọi</button>
              <button type="button" onClick={() => setFilterTab("location")} className={`mt-2 flex min-h-[48px] w-full items-center gap-3 rounded-xl px-4 text-left text-[15px] font-semibold ${filterTab === "location" ? "bg-m3-primary-container text-m3-on-primary-container" : "text-m3-on-surface-variant hover:bg-m3-surface-container"}`}><MapPinned size={19} /> Địa phương</button>
            </div>
            <div className="min-h-[230px] p-6">
              {filterTab === "campaign" && <><label className="mb-2 block text-[15px] font-semibold text-m3-on-surface">Chọn đợt khám tuyển</label><select value={draftCampaignId} onChange={(event) => setDraftCampaignId(event.target.value)} className="h-12 w-full rounded-xl border border-m3-outline-variant bg-m3-surface-lowest px-4 text-[15px] outline-none focus:border-m3-primary"><option value="">Tất cả các đợt</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} ({campaign.year})</option>)}</select></>}
              {filterTab === "status" && <div><label className="mb-3 block text-[15px] font-semibold text-m3-on-surface">Trạng thái dự kiến gọi</label><div className="grid gap-3 sm:grid-cols-2">{CALL_FILTER_OPTIONS.map((option) => <button type="button" key={option.value || "all"} onClick={() => setDraftCallIntent(option.value)} className={`min-h-[48px] rounded-xl border px-4 text-left text-[15px] transition-colors ${draftCallIntent === option.value ? "border-m3-primary bg-m3-primary-container font-semibold text-m3-on-primary-container" : "border-m3-outline-variant text-m3-on-surface-variant hover:bg-m3-surface-container"}`}>{option.label}</button>)}</div></div>}
              {filterTab === "location" && <div><p className="mb-3 text-[15px] font-semibold text-m3-on-surface">Địa phương đang xem</p><p className="rounded-xl bg-m3-surface-container-low px-4 py-3 text-[15px] text-m3-on-surface-variant">{scopeMeta?.name || "Chưa chọn địa phương"}</p><p className="mt-3 text-sm text-m3-on-surface-variant">Đổi tỉnh hoặc xã/phường tại thanh lọc phía trên.</p></div>}
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-m3-outline-variant px-5 py-4"><button type="button" onClick={() => setFilterOpen(false)} className="rounded-xl px-5 py-2.5 text-[15px] font-semibold text-m3-on-surface-variant hover:bg-m3-surface-container">Hủy bỏ</button><button type="button" onClick={applyFilters} className="rounded-xl bg-m3-primary px-6 py-2.5 text-[15px] font-semibold text-white hover:opacity-90">Áp dụng</button></div>
          </div>
        </div>
      )}

      <div className="macos-card overflow-hidden">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left">
            <thead className="bg-m3-surface-high text-[13px] font-bold uppercase tracking-wide text-m3-on-surface-variant">
              <tr>
                <th className="px-5 py-4">Họ và tên</th>
                <th className="px-5 py-4">Ngày sinh</th>
                <th className="px-5 py-4">CCCD</th>
                <th className="hidden px-5 py-4 lg:table-cell">Học vấn</th>
                <th className="hidden px-5 py-4 md:table-cell min-w-[160px]">Địa chỉ</th>
                <th className="hidden px-5 py-4 sm:table-cell">Sức khỏe</th>
                <th className="px-5 py-4">Dự kiến gọi</th>
                <th className="hidden px-5 py-4 xl:table-cell">Ghi chú</th>
                <th className="w-0 p-0" aria-hidden />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={TABLE_COLS} className="px-5 py-10 text-center text-[15px] text-m3-on-surface-variant">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : citizens.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLS} className="px-5 py-10 text-center text-[15px] text-m3-on-surface-variant">
                    {requiresUnitSelection
                      ? "Chọn tỉnh / thành phố ở trên để xem hồ sơ công dân theo địa phương."
                      : 'Không tìm thấy công dân. Bấm "Thêm công dân" để tạo mới.'}
                  </td>
                </tr>
              ) : (
                citizens.map((citizen) => {
                  const statusInfo = getCallLabel(citizen);
                  const healthStyle = getHealthStyle(citizen.healthStatus);
                  return (
                    <tr key={citizen.id} className="group relative hover:bg-m3-surface-high/70">
                      <td className="px-5 py-4">
                        <div className="text-[16px] font-bold text-m3-on-surface">
                          {citizen.fullName}
                        </div>
                        <div className="mt-0.5 text-[13px] text-m3-on-surface-variant">
                          {citizen.gender === "male" ? "Nam" : "Nữ"} · {citizen.phone || "—"}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[15px] text-m3-on-surface">
                        {new Date(citizen.dateOfBirth).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-5 py-4 font-mono text-[14px] font-semibold text-m3-on-surface">
                        {citizen.cccd}
                      </td>
                      <td className="hidden px-5 py-4 lg:table-cell">
                        <div className="text-[15px] font-semibold text-m3-on-surface">
                          {citizen.educationLevel}
                        </div>
                        <div className="text-[13px] text-m3-on-surface-variant">{citizen.job || "—"}</div>
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
                          <span className="text-[14px] text-m3-on-surface-variant">—</span>
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
                          <div className="flex items-center gap-2 rounded-[14px] bg-m3-surface-lowest/95 px-2 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] backdrop-blur-sm max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none max-sm:ring-0">
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
            <span className="font-medium text-m3-on-surface-variant">
              Trang {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="min-h-[44px] rounded-[12px] border border-black/[0.08] px-4 font-bold text-m3-on-surface disabled:opacity-40"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="min-h-[44px] rounded-[12px] border border-black/[0.08] px-4 font-bold text-m3-on-surface disabled:opacity-40"
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
    return <span className="text-[14px] text-m3-on-surface-variant">—</span>;
  }
  return (
    <span
      className={`block truncate text-[14px] ${maxW} ${muted ? "text-m3-on-surface-variant" : "text-m3-on-surface"}`}
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
    gray: "bg-m3-surface-high text-m3-on-surface hover:bg-m3-outline-variant",
    blue: "bg-m3-primary/12 text-m3-primary hover:bg-m3-primary/18",
    red: "bg-m3-error/10 text-m3-error hover:bg-m3-error/16",
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
