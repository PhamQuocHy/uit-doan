"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, RefreshCw, Search } from "lucide-react";
import type { Citizen, HierarchyUnit } from "@/lib/data";
import CitizenDetailModal from "@/components/admin/CitizenDetailModal";
import { buildPageItems } from "@/components/admin/list-ui";
import { subscribeCitizensChanged } from "@/lib/citizens-realtime";
import SearchableSelect from "@/components/ui/SearchableSelect";

const SELECT_CLS =
  "h-9 min-w-0 rounded-full border border-black/[0.08] bg-white px-3.5 pr-8 text-[13px] font-medium text-m3-on-surface outline-none transition-colors hover:border-m3-primary/30 focus:border-m3-primary/40 focus:ring-2 focus:ring-m3-primary/10";

const STATUS_OPTIONS = [
  { value: "chuakham", label: "Chưa khám" },
  { value: "dangkham", label: "Đang khám" },
  { value: "", label: "Tất cả trạng thái" },
] as const;

type CampaignOption = {
  id: string;
  name: string;
  year: number;
};

/**
 * Danh sách chờ khám sức khỏe — realtime để cán bộ y tế nhập tiếp sau khi thêm hồ sơ.
 */
export default function HealthQueuePage() {
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [militaryStatus, setMilitaryStatus] = useState("chuakham");
  const [viewCitizen, setViewCitizen] = useState<Citizen | null>(null);
  const [sessionLevel, setSessionLevel] = useState<string | null>(null);
  const [sessionUnitCode, setSessionUnitCode] = useState<string | null>(null);
  const [filterTinh, setFilterTinh] = useState("");
  const [filterXa, setFilterXa] = useState("");
  const [provinces, setProvinces] = useState<HierarchyUnit[]>([]);
  const [wards, setWards] = useState<HierarchyUnit[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [requiresUnit, setRequiresUnit] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

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
      const data = res.ok ? await res.json() : { items: [] };
      setWards(data.items || []);
    } catch {
      setWards([]);
    }
  }, []);

  const fetchList = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (sessionLevel === null) return;
      if (!opts?.silent) setLoading(true);
      try {
        const query = new URLSearchParams({
          page: String(page),
          limit: "20",
          ageScope: "active",
          ...(search.trim() && { search: search.trim() }),
          ...(militaryStatus && { militaryStatus }),
          ...(campaignId && { campaignId }),
          ...(effectiveUnitCode && { unitCode: effectiveUnitCode }),
        });
        const res = await fetch(`/api/admin/citizens?${query.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        setCitizens(Array.isArray(data.data) ? data.data : []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total ?? 0);
        setRequiresUnit(Boolean(data.meta?.requiresUnitSelection));
        setLastSync(new Date());
      } catch {
        if (!opts?.silent) {
          setCitizens([]);
          setTotalCount(0);
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [sessionLevel, page, search, militaryStatus, campaignId, effectiveUnitCode],
  );

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data) => {
        const level = data?.user?.hierarchyLevel ?? null;
        const unitCode = data?.user?.unitCode ?? null;
        setSessionLevel(level);
        setSessionUnitCode(unitCode);
        if (level === "bo") {
          const res = await fetch("/api/admin/hierarchy/children?parentCode=bo");
          const provData = res.ok ? await res.json() : { items: [] };
          setProvinces(provData.items || []);
        } else if (level === "tinh" && unitCode) {
          setFilterTinh(unitCode);
          await loadWards(unitCode);
        }
      })
      .catch(() => {
        setSessionLevel(null);
        setSessionUnitCode(null);
      });

    fetch("/api/admin/recruitment?limit=100")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = (data?.data || data?.items || []) as CampaignOption[];
        setCampaigns(
          [...list].sort(
            (a, b) => b.year - a.year || a.name.localeCompare(b.name, "vi"),
          ),
        );
      })
      .catch(() => setCampaigns([]));
  }, [loadWards]);

  useEffect(() => {
    if (sessionLevel === null) return;
    void fetchList();
  }, [fetchList, sessionLevel]);

  useEffect(() => {
    if (sessionLevel === null) return;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      void fetchList({ silent: true });
    };
    const unsub = subscribeCitizensChanged(() => refresh());
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(refresh, 8_000);
    return () => {
      unsub();
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [sessionLevel, fetchList]);

  const pageItems = buildPageItems(page, totalPages);
  const showLocalityFilters =
    sessionLevel === "bo" || sessionLevel === "tinh";

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h1 className="text-[24px] font-bold tracking-tight text-m3-on-surface">
            Khám sức khỏe
          </h1>

          {campaigns.length > 0 && (
            <select
              className={`${SELECT_CLS} max-w-[min(100%,360px)] min-w-[200px]`}
              value={campaignId}
              onChange={(e) => {
                setCampaignId(e.target.value);
                setPage(1);
              }}
              aria-label="Đợt khám"
            >
              <option value="">Tất cả đợt khám</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.year} · {c.name}
                </option>
              ))}
            </select>
          )}

          {showLocalityFilters && (
            <>
              {sessionLevel === "bo" && (
                <SearchableSelect
                  variant="compact"
                  className="max-w-[200px] min-w-[160px]"
                  value={filterTinh}
                  onChange={(code) => {
                    setFilterTinh(code);
                    setFilterXa("");
                    setPage(1);
                    void loadWards(code);
                  }}
                  ariaLabel="Chọn tỉnh"
                  placeholder="Tỉnh / TP"
                  options={[
                    { value: "", label: "Tỉnh / TP" },
                    ...provinces.map((p) => ({
                      value: p.code,
                      label: p.name,
                    })),
                  ]}
                />
              )}
              {(sessionLevel === "tinh" || filterTinh) && (
                <SearchableSelect
                  variant="compact"
                  className="max-w-[240px] min-w-[180px]"
                  value={filterXa}
                  onChange={(code) => {
                    setFilterXa(code);
                    setPage(1);
                  }}
                  ariaLabel="Chọn địa phương"
                  placeholder={
                    sessionLevel === "tinh"
                      ? "Tất cả địa phương thuộc tỉnh"
                      : "Tất cả xã / phường"
                  }
                  options={[
                    {
                      value: "",
                      label:
                        sessionLevel === "tinh"
                          ? "Tất cả địa phương thuộc tỉnh"
                          : "Tất cả xã / phường",
                    },
                    ...wards.map((w) => ({
                      value: w.code,
                      label: w.name,
                    })),
                  ]}
                />
              )}
            </>
          )}

          {!requiresUnit && (
            <span className="rounded-full bg-emerald-600/10 px-3 py-1 text-[12px] font-semibold text-emerald-800">
              {totalCount.toLocaleString("vi-VN")} hồ sơ
            </span>
          )}
          {lastSync && (
            <span className="text-[12px] text-m3-on-surface-variant">
              Cập nhật {lastSync.toLocaleTimeString("vi-VN")}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void fetchList()}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 text-[13px] font-semibold hover:bg-m3-surface-high"
        >
          <RefreshCw size={15} />
          Làm mới
        </button>
      </div>

      <p className="text-[14px] text-m3-on-surface-variant">
        {sessionLevel === "xa"
          ? "Cấp xã nhập Vòng 1 (sơ tuyển). Danh sách tự cập nhật khi có hồ sơ mới."
          : sessionLevel === "tinh"
            ? "Cấp tỉnh nhập Vòng 2 (khám chi tiết) sau khi xã hoàn thành sơ tuyển đạt."
            : "Danh sách công dân chờ nhập khám — tự cập nhật khi có hồ sơ mới."}
      </p>

      {requiresUnit && (
        <p className="text-[14px] text-m3-on-surface-variant">
          Chọn tỉnh / thành phố để xem danh sách chờ khám.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const active = militaryStatus === opt.value;
          return (
            <button
              key={opt.value || "all"}
              type="button"
              onClick={() => {
                setMilitaryStatus(opt.value);
                setPage(1);
              }}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
                active
                  ? "bg-m3-primary text-white"
                  : "bg-white text-m3-on-surface ring-1 ring-black/[0.08]"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
        <div className="relative ml-auto min-w-[220px] flex-1 sm:max-w-[320px]">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant"
          />
          <input
            className="h-10 w-full rounded-full border border-black/[0.08] bg-white pl-9 pr-3 text-[14px] outline-none focus:border-m3-primary/40 focus:ring-2 focus:ring-m3-primary/10"
            placeholder="Tìm tên, CCCD..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-[16px] border border-black/[0.06] bg-white">
        <table className="w-full text-left text-[14px]">
          <thead>
            <tr className="text-[12px] text-m3-on-surface-variant">
              <th className="bg-[#f1f5f9] px-4 py-3 font-semibold">Họ và tên</th>
              <th className="bg-[#f1f5f9] px-4 py-3 font-semibold">CCCD</th>
              <th className="hidden bg-[#f1f5f9] px-4 py-3 font-semibold sm:table-cell">
                Ngày sinh
              </th>
              <th className="bg-[#f1f5f9] px-4 py-3 font-semibold">Sức khỏe</th>
              <th className="bg-[#f1f5f9] px-4 py-3 font-semibold">Trạng thái</th>
              <th className="bg-[#f1f5f9] px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-m3-on-surface-variant"
                >
                  Đang tải...
                </td>
              </tr>
            ) : requiresUnit ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-m3-on-surface-variant"
                >
                  Chọn tỉnh / thành phố ở trên để xem hồ sơ.
                </td>
              </tr>
            ) : citizens.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-m3-on-surface-variant"
                >
                  Không có hồ sơ chờ khám.
                </td>
              </tr>
            ) : (
              citizens.map((c, idx) => (
                <tr
                  key={c.id}
                  className={`border-b border-black/[0.04] hover:bg-sky-50/70 ${
                    idx % 2 === 1 ? "bg-[#f8fafc]" : "bg-white"
                  }`}
                >
                  <td className="px-4 py-3.5 font-semibold">{c.fullName}</td>
                  <td className="px-4 py-3.5 font-mono text-[13px]">{c.cccd}</td>
                  <td className="hidden px-4 py-3.5 sm:table-cell">
                    {c.dateOfBirth?.slice(0, 10).split("-").reverse().join("/")}
                  </td>
                  <td className="px-4 py-3.5">{c.healthStatus || "—"}</td>
                  <td className="px-4 py-3.5">
                    {c.militaryStatus === "chuakham"
                      ? "Chưa khám"
                      : c.militaryStatus === "dangkham"
                        ? "Đang khám"
                        : c.militaryStatus}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => setViewCitizen(c)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-m3-primary/10 px-3 py-1.5 text-[12px] font-bold text-m3-primary hover:bg-m3-primary/15"
                    >
                      <Eye size={14} />
                      Nhập khám
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1">
          {pageItems.map((item, i) =>
            item === "…" ? (
              <span key={`e-${i}`} className="px-2 text-m3-on-surface-variant">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => setPage(Number(item))}
                className={`min-w-9 rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                  page === item
                    ? "bg-m3-primary text-white"
                    : "bg-white ring-1 ring-black/[0.08]"
                }`}
              >
                {item}
              </button>
            ),
          )}
        </div>
      )}

      {viewCitizen && (
        <CitizenDetailModal
          citizen={viewCitizen}
          initialTab="health"
          onClose={() => setViewCitizen(null)}
          onCitizenUpdated={(updated) => {
            setViewCitizen(updated);
            setCitizens((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c)),
            );
            void fetchList({ silent: true });
          }}
        />
      )}
    </div>
  );
}
