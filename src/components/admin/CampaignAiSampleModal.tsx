"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles, X, Loader2, CheckCircle2 } from "lucide-react";
import {
  AdminPrimaryBtn,
  AdminGhostBtn,
  AdminStatusTabs,
  ADMIN_TH_CLS,
  ADMIN_TD_CLS,
} from "@/components/admin/list-ui";

export type AiSampleRow = {
  citizenId: string;
  fullName: string;
  cccd: string;
  ageInYear: number;
  unitCode: string;
  healthGrade: number | null;
  suggestion: "du_kien_goi" | "du_bi" | "khong_goi" | "tamhoan";
  confidence: number;
  draftNote: string;
  reasons: string[];
  warnings: string[];
  label: string;
  source: string;
  fromPreviousDeferral?: boolean;
};

type Summary = {
  eligibleTotal: number;
  analyzed: number;
  counts: Record<string, number>;
  previousDeferralRolled?: number;
  narrative: string;
  gemini: boolean;
  scopeLabel?: string;
};

const TABS = [
  { value: "du_kien_goi", label: "Dự kiến gọi" },
  { value: "du_bi", label: "Dự bị" },
  { value: "khong_goi", label: "Không gọi" },
  { value: "tamhoan", label: "Tạm hoãn" },
] as const;

type Props = {
  open: boolean;
  campaignId: string;
  campaignName: string;
  campaignYear: number;
  onClose: () => void;
  onApplied?: () => void;
};

export default function CampaignAiSampleModal({
  open,
  campaignId,
  campaignName,
  campaignYear,
  onClose,
  onApplied,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<AiSampleRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tab, setTab] = useState<string>("du_kien_goi");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [applyResult, setApplyResult] = useState<string>("");

  const runAnalyze = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError("");
    setApplyResult("");
    try {
      const res = await fetch(
        `/api/admin/recruitment/${encodeURIComponent(campaignId)}/ai-sample`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không phân tích được");
      const rows = (json.items || []) as AiSampleRow[];
      setItems(rows);
      setSummary(json.summary || null);
      const next: Record<string, boolean> = {};
      for (const row of rows) {
        // Chọn sẵn: dự kiến gọi / tạm hoãn độ tin cậy cao + mọi hồ sơ tạm hoãn đợt trước
        next[row.citizenId] =
          Boolean(row.fromPreviousDeferral) ||
          ((row.suggestion === "du_kien_goi" || row.suggestion === "tamhoan") &&
            row.confidence >= 0.7);
      }
      setSelected(next);
      const firstWithData = TABS.find(
        (t) => rows.some((r) => r.suggestion === t.value),
      );
      if (firstWithData) setTab(firstWithData.value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi phân tích AI");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (!open || !campaignId) return;
    setItems([]);
    setSummary(null);
    setSelected({});
    setError("");
    setApplyResult("");
    void runAnalyze();
  }, [open, campaignId, runAnalyze]);

  const filtered = useMemo(
    () => items.filter((i) => i.suggestion === tab),
    [items, tab],
  );

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected],
  );

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of TABS) {
      c[t.value] = items.filter((i) => i.suggestion === t.value).length;
    }
    return c;
  }, [items]);

  const toggleAllFiltered = (on: boolean) => {
    setSelected((prev) => {
      const next = { ...prev };
      for (const row of filtered) next[row.citizenId] = on;
      return next;
    });
  };

  const applySelected = async () => {
    const payload = items
      .filter((i) => selected[i.citizenId])
      .map((i) => ({
        citizenId: i.citizenId,
        suggestion: i.suggestion,
        draftNote: i.draftNote,
      }));
    if (payload.length === 0) {
      setError("Chọn ít nhất một hồ sơ để áp dụng");
      return;
    }
    setApplying(true);
    setError("");
    setApplyResult("");
    try {
      const res = await fetch(
        `/api/admin/recruitment/${encodeURIComponent(campaignId)}/apply-ai-sample`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: payload }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không áp dụng được");
      setApplyResult(
        `Đã gắn ${json.meta?.appliedCount ?? 0} hồ sơ vào đợt. Bỏ qua ${json.meta?.skippedCount ?? 0}.`,
      );
      onApplied?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi áp dụng");
    } finally {
      setApplying(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-m3-on-surface">
              <Sparkles size={18} className="text-m3-primary" />
              AI gợi ý danh sách mẫu
            </h2>
            <p className="mt-0.5 text-[13px] text-m3-on-surface-variant">
              {campaignName} · Năm {campaignYear} — thanh niên còn trong tuổi
              NVQS
              {summary?.scopeLabel
                ? ` · Phạm vi: ${summary.scopeLabel}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-m3-on-surface-variant hover:bg-black/[0.04]"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-m3-on-surface-variant">
              <Loader2 className="h-8 w-8 animate-spin text-m3-primary" />
              <p className="text-sm font-medium">
                Đang phân tích hồ sơ đủ tuổi…
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              {error}
            </div>
          )}

          {!loading && applyResult && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              {applyResult}
            </div>
          )}

          {!loading && summary && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TABS.map((t) => (
                  <div
                    key={t.value}
                    className="rounded-xl border border-black/[0.06] bg-m3-surface-container-low px-3 py-2.5"
                  >
                    <p className="text-[11px] text-m3-on-surface-variant">
                      {t.label}
                    </p>
                    <p className="text-xl font-bold text-m3-on-surface">
                      {summary.counts?.[t.value] ?? tabCounts[t.value] ?? 0}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mb-4 rounded-xl border border-m3-primary/15 bg-m3-primary-container/30 px-4 py-3 text-[13px] leading-relaxed text-m3-on-surface">
                {summary.narrative}
                <span className="mt-1 block text-[11px] text-m3-on-surface-variant">
                  Phạm vi: {summary.scopeLabel || "—"} · Đã phân tích{" "}
                  {summary.analyzed}/{summary.eligibleTotal} hồ sơ đủ tuổi
                  {typeof summary.previousDeferralRolled === "number"
                    ? ` · ${summary.previousDeferralRolled} hồ sơ tạm hoãn đợt trước → dự kiến gọi`
                    : ""}
                  {summary.gemini ? " · có Gemini" : " · quy tắc (chưa Gemini)"}
                </span>
              </p>

              <AdminStatusTabs
                tabs={TABS.map((t) => ({
                  value: t.value,
                  label: `${t.label} (${tabCounts[t.value] || 0})`,
                }))}
                value={tab}
                onChange={setTab}
              />

              <div className="mt-3 mb-2 flex flex-wrap items-center gap-2">
                <AdminGhostBtn onClick={() => toggleAllFiltered(true)}>
                  Chọn tab này
                </AdminGhostBtn>
                <AdminGhostBtn onClick={() => toggleAllFiltered(false)}>
                  Bỏ chọn tab
                </AdminGhostBtn>
                <span className="text-xs text-m3-on-surface-variant">
                  Đã chọn {selectedCount} hồ sơ
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-black/[0.06]">
                <table className="min-w-[720px] w-full text-left">
                  <thead className="bg-m3-surface-container-low">
                    <tr>
                      <th className={`${ADMIN_TH_CLS} w-10`} />
                      <th className={ADMIN_TH_CLS}>Họ tên</th>
                      <th className={ADMIN_TH_CLS}>Tuổi/{campaignYear}</th>
                      <th className={ADMIN_TH_CLS}>SK</th>
                      <th className={ADMIN_TH_CLS}>Độ tin cậy</th>
                      <th className={ADMIN_TH_CLS}>Gợi ý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-sm text-m3-on-surface-variant"
                        >
                          Không có hồ sơ trong nhóm này
                        </td>
                      </tr>
                    ) : (
                      filtered.map((row) => (
                        <tr
                          key={row.citizenId}
                          className="border-t border-black/[0.04]"
                        >
                          <td className={ADMIN_TD_CLS}>
                            <input
                              type="checkbox"
                              checked={Boolean(selected[row.citizenId])}
                              onChange={(e) =>
                                setSelected((prev) => ({
                                  ...prev,
                                  [row.citizenId]: e.target.checked,
                                }))
                              }
                              aria-label={`Chọn ${row.fullName}`}
                            />
                          </td>
                          <td className={ADMIN_TD_CLS}>
                            <div className="font-semibold text-[14px]">
                              {row.fullName}
                            </div>
                            <div className="font-mono text-xs text-m3-on-surface-variant">
                              {row.cccd}
                            </div>
                            {row.fromPreviousDeferral ? (
                              <div className="mt-0.5 text-[11px] font-semibold text-m3-primary">
                                Từ tạm hoãn đợt trước → dự kiến gọi (cập nhật sau)
                              </div>
                            ) : null}
                            {row.warnings[0] ? (
                              <div className="mt-0.5 text-[11px] text-amber-700">
                                {row.warnings[0]}
                              </div>
                            ) : null}
                          </td>
                          <td className={ADMIN_TD_CLS}>{row.ageInYear}</td>
                          <td className={ADMIN_TD_CLS}>
                            {row.healthGrade != null
                              ? `Loại ${row.healthGrade}`
                              : "—"}
                          </td>
                          <td className={ADMIN_TD_CLS}>
                            {Math.round(row.confidence * 100)}%
                          </td>
                          <td className={`${ADMIN_TD_CLS} text-xs`}>
                            <div className="font-semibold">{row.label}</div>
                            <div className="text-m3-on-surface-variant italic">
                              {row.draftNote}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] px-5 py-3">
          <button
            type="button"
            onClick={() => void runAnalyze()}
            disabled={loading || applying}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 text-[13px] font-semibold text-m3-on-surface hover:bg-m3-surface-high disabled:opacity-50"
          >
            Phân tích lại
          </button>
          <div className="flex gap-2">
            <AdminGhostBtn onClick={onClose}>Đóng</AdminGhostBtn>
            <AdminPrimaryBtn
              tone="blue"
              onClick={() => void applySelected()}
              disabled={loading || applying || selectedCount === 0}
            >
              {applying
                ? "Đang áp dụng…"
                : `Áp dụng vào đợt (${selectedCount})`}
            </AdminPrimaryBtn>
          </div>
        </div>
        <p className="border-t border-black/[0.04] px-5 py-2 text-[11px] text-m3-on-surface-variant">
          Áp dụng chỉ <strong>thêm</strong> đợt mới vào lịch sử hồ sơ — không xóa
          khỏi đợt cũ (vd. vẫn còn trong 2026 khi gắn 2027). Hồ sơ đã duyệt gọi
          bị bỏ qua.
        </p>
      </div>
    </div>
  );
}
