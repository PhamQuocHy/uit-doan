"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Citizen, EducationRecord, HealthRecord, ResidenceRecord } from "@/lib/data";
import { getUnitByCode } from "@/lib/hierarchy";
import { buildCitizenHealthPrintHtml } from "@/lib/citizen-health-print";
import { isRoundTwo, selectPrintExam } from "@/lib/print-exam-selection";

export default function CitizenHealthPrintPreview({ citizen, records, education, residence, selectedRecordId, onClose }: {
  citizen: Citizen;
  records: HealthRecord[];
  education: EducationRecord[];
  residence: ResidenceRecord[];
  selectedRecordId?: string;
  onClose: () => void;
}) {
  const available = useMemo(() => records.filter(r => r.citizenId === citizen.id)
    .sort((a, b) => b.year - a.year || b.createdAt.localeCompare(a.createdAt)), [records, citizen.id]);
  const initial = available.find(record => record.id === selectedRecordId) || available[0];
  const [year, setYear] = useState(initial?.year || new Date().getFullYear());
  const [round, setRound] = useState<1 | 2>(initial && isRoundTwo(initial) ? 2 : 1);
  const years = [...new Set(available.map(record => record.year))];
  const selection = useMemo(() => selectPrintExam(available, citizen.id, year, round), [available, citizen.id, year, round]);
  const [wordBusy, setWordBusy] = useState(false);
  const [wordError, setWordError] = useState("");
  const [ready, setReady] = useState(false);
  const [imageError, setImageError] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const unit = getUnitByCode(citizen.unitCode || "");
  const parent = getUnitByCode(unit?.parentCode || "");
  const city = unit?.level === "tinh" ? unit : parent?.level === "tinh" ? parent : getUnitByCode(parent?.parentCode || "");
  const html = useMemo(() => buildCitizenHealthPrintHtml(citizen, selection.record,
    unit?.level === "xa" ? unit.name.replace(/^(xã|phường)\s+/i, "") : "", {
      cityName: city?.level === "tinh" ? city.name.replace(/^(thành phố|tỉnh)\s+/i, "") : "",
      campaignName: selection.record ? undefined : `Sơ tuyển năm ${year}`,
      education, residence,
    }), [citizen, selection.record, year, unit, city, education, residence]);

  async function downloadWord() {
    setWordBusy(true);
    setWordError("");
    try {
      const { registrationWordBlob } = await import("@/lib/registration-word");
      const blob = await registrationWordBlob(html);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ho-so-nvqs-${year}-vong-${selection.round}.docx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setWordError("Không tạo được file Word. Vui lòng thử lại hoặc kiểm tra ảnh công dân.");
    } finally { setWordBusy(false); }
  }

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus();
  }, []);

  return <div role="dialog" aria-modal="true" aria-labelledby="health-print-title"
    className="fixed inset-0 z-[100] flex flex-col bg-slate-100"
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-5 py-3">
      <div><h2 id="health-print-title" className="font-bold">Hồ sơ đăng ký nghĩa vụ quân sự</h2>
        <p className="text-sm text-slate-600">Khổ A4 dọc · Mục chưa có dữ liệu để trống </p></div>
      <div className="flex flex-wrap items-center gap-3">
        {years.length > 1 && <label className="text-sm">Năm khám{" "}<select className="rounded border p-2" value={year}
          onChange={event => { setReady(false); setYear(Number(event.target.value)); setRound(1); }}>
          {years.map(value => <option key={value} value={value}>{value}</option>)}
        </select></label>}
        {selection.hasRoundTwo ? <label className="text-sm">Vòng khám{" "}<select className="rounded border p-2" value={selection.round}
          onChange={event => { setReady(false); setRound(Number(event.target.value) as 1 | 2); }}>
          <option value={1}>Vòng 1 — Sơ tuyển</option>
          <option value={2}>Vòng 2 — Khám chi tiết</option>
        </select></label> : <span className="text-sm">Vòng 1 — Sơ tuyển</span>}
        {!selection.record && <span className="text-sm text-slate-600">Chưa có kết quả vòng {selection.round} năm {year}</span>}
        <button type="button" disabled={!ready || wordBusy} onClick={() => void downloadWord()}
          className="rounded-lg border px-4 py-2 font-semibold disabled:opacity-50">{wordBusy ? "Đang tạo Word…" : "Tải Word (.docx)"}</button>
        <button type="button" disabled={!ready} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
          onClick={() => { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); }}>In / Lưu PDF</button>
        <button ref={closeButton} type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Đóng bản in</button>
      </div>
    </div>
    {wordError && <p role="alert" className="bg-red-50 px-5 py-2 text-sm text-red-700">{wordError}</p>}
    {imageError && <p role="alert" className="bg-red-50 px-5 py-2 text-sm text-red-700">Không tải được ảnh công dân. Vui lòng kiểm tra ảnh trong hồ sơ và mở lại bản in.</p>}
    <iframe key={`${year}-${selection.round}-${selection.record?.id || "blank"}`} ref={frame} title="Bản xem trước hồ sơ đăng ký nghĩa vụ quân sự" srcDoc={html}
      onLoad={() => {
        const images = Array.from(frame.current?.contentDocument?.images || []);
        const failed = images.some(image => !image.complete || image.naturalWidth === 0);
        setImageError(failed);
        setReady(!failed);
      }} className="min-h-0 w-full flex-1 border-0" />
  </div>;
}
