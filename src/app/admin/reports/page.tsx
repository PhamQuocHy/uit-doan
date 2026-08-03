"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Calendar,
  Download,
  MapPin,
  PieChart as PieIcon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserX,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import type { AnalyticsDashboard } from "@/lib/analytics/types";
import StatCard from "@/components/ui/StatCard";

const OLIVE = {
  deep: "#1d1d1f",
  forest: "#1d1d1f",
  primary: "#007aff",
  mid: "#86868b",
  soft: "#64b5ff",
  wash: "#e5e5ea",
  canvas: "#f5f5f7",
  muted: "#636366",
};

const CHART = {
  called: "#c7e0ff",
  passed: "#007aff",
  enlisted: "#0055b3",
  funnel: "#007aff",
  quotaBg: "#e5e5ea",
  quotaFill: "#007aff",
  pie: ["#007aff", "#5ac8fa", "#34c759", "#ff9500", "#af52de", "#8e8e93"],
};

const tooltipStyle = {
  background: "#ffffff",
  border: `1px solid ${OLIVE.wash}`,
  borderRadius: 12,
  boxShadow: "0 12px 40px rgba(43,48,18,0.08)",
  fontSize: 12,
};

export default function ReportsPage() {
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [userHierarchyLevel, setUserHierarchyLevel] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiMeta, setAiMeta] = useState<{
    model?: string;
    dataSource?: string;
  } | null>(null);
  const [geminiReady, setGeminiReady] = useState(false);

  const fetchAiAnalysis = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const scopeUnit = unitCode || undefined;
      const res = await fetch("/api/admin/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: yearFilter,
          unitCode: scopeUnit,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không tạo được phân tích AI");
      setAiAnalysis(json.analysis);
      setAiMeta({ model: json.model, dataSource: json.dataSource });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Lỗi phân tích AI");
      setAiAnalysis(null);
    } finally {
      setAiLoading(false);
    }
  }, [yearFilter, unitCode]);

  useEffect(() => {
    fetch("/api/admin/ai/analyze")
      .then((r) => r.json())
      .then((j) => setGeminiReady(Boolean(j.configured)))
      .catch(() => setGeminiReady(false));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const meRes = await fetch("/api/auth/me");
      const meJson = await meRes.json();
      setUserHierarchyLevel(meJson.user?.hierarchyLevel || "");
      const sessionUnit = meJson.user?.unitCode || "";
      if (!unitCode && sessionUnit) setUnitCode(sessionUnit);

      const params = new URLSearchParams({ year: yearFilter });
      const scopeUnit = unitCode || sessionUnit;
      if (scopeUnit) params.set("unitCode", scopeUnit);

      const res = await fetch(`/api/admin/reports?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Không tải được báo cáo");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải báo cáo");
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [yearFilter, unitCode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([data.overview]), "KPI");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data.recruitmentStatsByYear),
      "Theo_nam"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data.defermentReasons),
      "Tam_hoan"
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.funnel), "Funnel");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.quotas), "Chi_tieu");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data.unitQualifyRates),
      "Dia_ban"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(data.educationVsHealth),
      "Hocvan_SK"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["", ...data.correlations.labels],
        ...data.correlations.matrix.map((row, i) => [
          data.correlations.labels[i],
          ...row,
        ]),
      ]),
      "Tuong_quan"
    );
    XLSX.writeFile(wb, `bao-cao-nvqs-${data.meta.year}-${data.meta.unitCode}.xlsx`);
  };

  const funnelMax = useMemo(() => {
    if (!data?.funnel.length) return 1;
    return Math.max(...data.funnel.map((f) => f.count), 1);
  }, [data]);

  if (loading && !data) {
    return <ReportsSkeleton />;
  }

  if (error || !data) {
    return (
      <div
        className="rounded-3xl p-8"
        style={{
          background: "linear-gradient(145deg, #fff5f5 0%, #ffffff 60%)",
          border: "1px solid #fecaca",
        }}
      >
        <h1 className="text-xl font-bold" style={{ color: "#991b1b" }}>
          Không tải được analytics
        </h1>
        <p className="mt-2 text-sm text-red-700">{error}</p>
        <p className="mt-1 text-xs text-red-500">
          Chạy <code className="rounded bg-red-100 px-1">npm run db:migrate</code> rồi{" "}
          <code className="rounded bg-red-100 px-1">npm run db:seed-analytics</code>
        </p>
        <button
          onClick={() => {
            setRefreshing(true);
            fetchData();
          }}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ background: "#b91c1c" }}
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Thử lại
        </button>
        {geminiReady && (
          <button
            type="button"
            onClick={fetchAiAnalysis}
            disabled={aiLoading}
            className="mt-3 ml-0 inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-800 transition hover:bg-red-50 disabled:opacity-50"
          >
            <Sparkles size={16} className={aiLoading ? "animate-pulse" : ""} />
            {aiLoading ? "Đang phân tích..." : "Phân tích AI (dữ liệu demo)"}
          </button>
        )}
        {aiError && (
          <p className="mt-3 text-sm text-red-600">{aiError}</p>
        )}
        {aiAnalysis && (
          <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm text-[#1d1d1f]">
            {aiAnalysis}
          </div>
        )}
      </div>
    );
  }

  const { overview } = data;
  const isDonvi = userHierarchyLevel === "donvi";
  const passedRate =
    overview.totalCitizens > 0
      ? Math.round((overview.passed / overview.totalCitizens) * 1000) / 10
      : 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-3xl px-6 py-7 text-white md:px-8"
        style={{
          background:
            "linear-gradient(135deg, #0a84ff 0%, #007aff 45%, #5ac8fa 100%)",
          boxShadow: "0 16px 40px rgba(0,122,255,0.22)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full"
          style={{ background: "rgba(255,255,255,0.12)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full"
          style={{ background: "rgba(255,255,255,0.1)" }}
        />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p
              className="text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: OLIVE.soft }}
            >
              Data Analytics - NVQS
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
              {isDonvi ? "Thống kê đơn vị nhận quân" : "Báo cáo & Thống kê"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/85">
              Phân tích tuyển quân theo năm, địa bàn và sức khỏe - dữ liệu MySQL realtime.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <MetaChip icon={<MapPin size={12} />} text={`Đơn vị ${data.meta.unitCode}`} />
              <MetaChip
                icon={<Calendar size={12} />}
                text={new Date(data.meta.generatedAt).toLocaleString("vi-VN")}
              />
              <MetaChip icon={<Activity size={12} />} text={`Tỷ lệ trúng tuyển ~${passedRate}%`} />
            </div>
          </div>

          <div
            className="flex flex-wrap items-center gap-2 rounded-2xl p-2 backdrop-blur-md"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="rounded-xl border-0 bg-white/95 px-3 py-2.5 text-sm font-medium outline-none"
              style={{ color: OLIVE.forest }}
            >
              {[2023, 2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
            {userHierarchyLevel === "bo" && (
              <input
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value)}
                placeholder="Mã đơn vị"
                className="w-32 rounded-xl border-0 bg-white/95 px-3 py-2.5 text-sm outline-none"
                style={{ color: OLIVE.forest }}
              />
            )}
            <button
              onClick={() => {
                setRefreshing(true);
                fetchData();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2.5 text-sm font-medium text-white transition hover:bg-white/25"
            >
              <RefreshCw size={15} className={refreshing || loading ? "animate-spin" : ""} />
              Làm mới
            </button>
            {geminiReady && (
              <button
                type="button"
                onClick={fetchAiAnalysis}
                disabled={aiLoading}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:brightness-105 disabled:opacity-60"
                style={{ background: OLIVE.wash, color: OLIVE.forest }}
              >
                <Sparkles size={15} className={aiLoading ? "animate-pulse" : ""} />
                {aiLoading ? "Đang phân tích..." : "Phân tích AI"}
              </button>
            )}
            <button
              onClick={exportExcel}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:brightness-105"
              style={{ background: OLIVE.wash, color: OLIVE.forest }}
            >
              <Download size={15} />
              Xuất Excel
            </button>
          </div>
        </div>
      </section>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Tổng thanh niên"
          value={overview.totalCitizens.toLocaleString("vi-VN")}
          color="olive"
          icon={<Users size={20} />}
        />
        <StatCard
          title="Sẵn sàng / đang khám"
          value={overview.availableForDraft.toLocaleString("vi-VN")}
          color="khaki"
          icon={<TrendingUp size={20} />}
          subtitle={`${overview.examining} đang khám`}
        />
        <StatCard
          title="Tạm hoãn"
          value={overview.deferred.toLocaleString("vi-VN")}
          color="alert"
          icon={<UserX size={20} />}
          subtitle={`${overview.exempted} miễn gọi`}
        />
        <StatCard
          title={isDonvi ? "Đã nhập ngũ" : "Đang tại ngũ"}
          value={overview.inService.toLocaleString("vi-VN")}
          color="forest"
          icon={<ShieldCheck size={20} />}
          subtitle={`${overview.passed} trúng tuyển`}
        />
      </div>

      {(aiAnalysis || aiError || aiLoading) && (
        <section
          className="rounded-3xl border p-5 md:p-6"
          style={{
            borderColor: OLIVE.wash,
            background: "linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)",
            boxShadow: "0 8px 30px rgba(0,122,255,0.06)",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles size={20} style={{ color: OLIVE.primary }} />
                <h2 className="text-lg font-bold" style={{ color: OLIVE.forest }}>
                  Phân tích AI (Gemini 3)
                </h2>
              </div>
              {aiMeta && (
                <p className="mt-1 text-xs" style={{ color: OLIVE.muted }}>
                  Model: {aiMeta.model}
                  {aiMeta.dataSource === "demo" ? " · dữ liệu demo (chưa có MySQL)" : " · MySQL"}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={fetchAiAnalysis}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
              style={{ background: OLIVE.primary, color: "#fff" }}
            >
              <RefreshCw size={14} className={aiLoading ? "animate-spin" : ""} />
              Tạo lại
            </button>
          </div>

          {aiLoading && (
            <p className="mt-4 text-sm" style={{ color: OLIVE.muted }}>
              Gemini đang đọc số liệu và tổng hợp nhận định...
            </p>
          )}

          {aiError && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{aiError}</p>
          )}

          {aiAnalysis && !aiLoading && (
            <div
              className="prose prose-sm mt-4 max-w-none whitespace-pre-wrap text-[15px] leading-relaxed"
              style={{ color: OLIVE.forest }}
            >
              {aiAnalysis}
            </div>
          )}
        </section>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3"
          title="Tuyển quân theo năm"
          subtitle="Gọi khám - Đạt - Nhập ngũ"
          icon={<BarChart3 size={18} />}
        >
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.recruitmentStatsByYear}
                barGap={4}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="4 8" vertical={false} stroke={OLIVE.wash} />
                <XAxis
                  dataKey="year"
                  tick={{ fill: OLIVE.muted, fontSize: 12, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: OLIVE.canvas }} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                  iconType="circle"
                />
                <Bar dataKey="called" name="Gọi khám" fill={CHART.called} radius={[8, 8, 0, 0]} />
                <Bar dataKey="passed" name="Đạt" fill={CHART.passed} radius={[8, 8, 0, 0]} />
                <Bar
                  dataKey="enlisted"
                  name="Nhập ngũ"
                  fill={CHART.enlisted}
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          className="xl:col-span-2"
          title="Lý do tạm hoãn / miễn"
          subtitle="Phân bổ theo nhóm"
          icon={<PieIcon size={18} />}
        >
          <div className="flex h-80 flex-col gap-4 sm:flex-row sm:items-center">
            {data.defermentReasons.length === 0 ? (
              <Empty />
            ) : (
              <>
                <div className="h-56 w-full sm:h-full sm:flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.defermentReasons}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={58}
                        outerRadius={88}
                        paddingAngle={3}
                        stroke="#fff"
                        strokeWidth={2}
                      >
                        {data.defermentReasons.map((_, i) => (
                          <Cell key={i} fill={CHART.pie[i % CHART.pie.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="w-full space-y-2.5 sm:w-44">
                  {data.defermentReasons.map((d, i) => (
                    <li key={d.reason} className="flex items-start gap-2 text-xs">
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: CHART.pie[i % CHART.pie.length] }}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold" style={{ color: OLIVE.forest }}>
                          {d.label}
                        </p>
                        <p style={{ color: OLIVE.mid }}>
                          {d.value} - {d.percentage}%
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Panel>
      </div>

      {/* Funnel + Quota */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Funnel trạng thái NVQS" subtitle="Luồng từ chưa khám → nhập ngũ">
          <div className="space-y-3">
            {data.funnel.map((step, idx) => {
              const pct = Math.round((step.count / funnelMax) * 100);
              return (
                <div key={step.status} className="group">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-semibold" style={{ color: OLIVE.forest }}>
                      {idx + 1}. {step.label}
                    </span>
                    <span className="tabular-nums font-bold" style={{ color: OLIVE.primary }}>
                      {step.count.toLocaleString("vi-VN")}
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full"
                    style={{ background: OLIVE.wash }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${OLIVE.soft}, ${OLIVE.primary})`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Chỉ tiêu vs thực hiện" subtitle={`Năm ${data.meta.year}`}>
          <div className="h-80">
            {data.quotas.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.quotas.slice(0, 8)}
                  margin={{ top: 8, right: 8, left: 0, bottom: 48 }}
                >
                  <CartesianGrid strokeDasharray="4 8" vertical={false} stroke={OLIVE.wash} />
                  <XAxis
                    dataKey="unitName"
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={60}
                    tick={{ fill: OLIVE.muted, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: OLIVE.canvas }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                  <Bar
                    dataKey="amount"
                    name="Chỉ tiêu"
                    fill={CHART.quotaBg}
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar
                    dataKey="filled"
                    name="Đã thực hiện"
                    fill={CHART.quotaFill}
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Tỷ lệ sức khỏe đạt theo địa bàn" subtitle="Top đơn vị">
          <div className="max-h-80 space-y-3 overflow-auto pr-1">
            {data.unitQualifyRates.length === 0 ? (
              <Empty />
            ) : (
              data.unitQualifyRates.map((u) => (
                <div
                  key={u.unitCode}
                  className="rounded-2xl px-3.5 py-3 transition hover:bg-[#f5f5f7]"
                  style={{ border: `1px solid ${OLIVE.wash}` }}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold" style={{ color: OLIVE.forest }}>
                      {u.unitName}
                    </p>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
                      style={{ background: OLIVE.canvas, color: OLIVE.primary }}
                    >
                      {u.qualifyRate}%
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full"
                    style={{ background: OLIVE.wash }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(u.qualifyRate, 100)}%`,
                        background: OLIVE.primary,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px]" style={{ color: OLIVE.mid }}>
                    {u.qualified}/{u.total} đạt sức khỏe
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Học vấn x Kết quả sức khỏe" subtitle="Cross-tab phân tích">
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: OLIVE.canvas }}>
                  {["Học vấn", "Phân loại", "Số lượng"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider"
                      style={{ color: OLIVE.muted }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.educationVsHealth.map((c, i) => (
                  <tr
                    key={i}
                    className="transition hover:bg-[#f5f5f7]"
                    style={{ borderTop: `1px solid ${OLIVE.wash}` }}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: OLIVE.forest }}>
                      {c.row}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{
                          background: c.col.includes("Đạt") ? OLIVE.canvas : "#fef2f2",
                          color: c.col.includes("Đạt") ? OLIVE.primary : "#dc2626",
                        }}
                      >
                        {c.col}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 tabular-nums font-bold"
                      style={{ color: OLIVE.deep }}
                    >
                      {c.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Correlation */}
      <Panel
        title="Ma trận tương quan (Pearson)"
        subtitle={`Mẫu n=${data.correlations.sampleSize} - sẵn sàng cho phase AI`}
      >
        <div className="overflow-auto">
          <table className="w-full min-w-[420px] border-separate border-spacing-1 text-center text-xs">
            <thead>
              <tr>
                <th className="p-2" />
                {data.correlations.labels.map((l) => (
                  <th
                    key={l}
                    className="p-2 font-bold uppercase tracking-wide"
                    style={{ color: OLIVE.muted }}
                  >
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.correlations.labels.map((rowLabel, i) => (
                <tr key={rowLabel}>
                  <th
                    className="p-2 text-left font-bold uppercase tracking-wide"
                    style={{ color: OLIVE.muted }}
                  >
                    {rowLabel}
                  </th>
                  {data.correlations.matrix[i].map((v, j) => (
                    <td key={j} className="p-0.5">
                      <div
                        className="rounded-xl px-2 py-3 font-semibold tabular-nums transition hover:scale-105"
                        style={{
                          backgroundColor: corrColor(v),
                          color: Math.abs(v) > 0.45 ? "#fff" : OLIVE.forest,
                        }}
                        title={`${rowLabel} x ${data.correlations.labels[j]}`}
                      >
                        {v.toFixed(2)}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function MetaChip({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium"
      style={{
        background: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.16)",
        color: "#e5e5ea",
      }}
    >
      {icon}
      {text}
    </span>
  );
}

function Panel({
  title,
  subtitle,
  icon,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-3xl ${className}`}
      style={{
        background: "#ffffff",
        border: `1px solid ${OLIVE.wash}`,
        boxShadow: "0 8px 30px rgba(0,0,0,0.03)",
      }}
    >
      <div
        className="flex items-start justify-between gap-3 px-5 py-4 md:px-6"
        style={{ borderBottom: "1px solid #e5e5ea" }}
      >
        <div className="flex items-start gap-3">
          {icon && (
            <div
              className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                background: OLIVE.canvas,
                color: OLIVE.primary,
                border: `1px solid ${OLIVE.soft}`,
              }}
            >
              {icon}
            </div>
          )}
          <div>
            <h2
              className="text-sm font-bold uppercase tracking-[0.06em]"
              style={{ color: OLIVE.deep }}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs font-medium" style={{ color: OLIVE.mid }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}

function Empty() {
  return (
    <div
      className="flex h-full min-h-40 w-full flex-col items-center justify-center rounded-2xl text-sm"
      style={{ background: OLIVE.canvas, color: OLIVE.mid }}
    >
      <BarChart3 size={28} className="mb-2 opacity-50" />
      Chưa có dữ liệu
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div
        className="h-44 rounded-3xl"
        style={{ background: `linear-gradient(125deg, ${OLIVE.deep}, ${OLIVE.primary})` }}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 rounded-3xl"
            style={{ background: "#fff", border: `1px solid ${OLIVE.wash}` }}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div
          className="h-96 rounded-3xl xl:col-span-3"
          style={{ background: "#fff", border: `1px solid ${OLIVE.wash}` }}
        />
        <div
          className="h-96 rounded-3xl xl:col-span-2"
          style={{ background: "#fff", border: `1px solid ${OLIVE.wash}` }}
        />
      </div>
    </div>
  );
}

function corrColor(v: number) {
  const t = Math.max(-1, Math.min(1, v));
  if (t >= 0) {
    return `rgba(0, 122, 255, ${0.12 + t * 0.78})`;
  }
  return `rgba(255, 59, 48, ${0.12 + -t * 0.78})`;
}
