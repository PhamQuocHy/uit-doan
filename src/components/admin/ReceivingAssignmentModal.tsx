"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Building2, Check, Loader2, MapPin, Search, ShieldCheck, UserRound, X } from "lucide-react";

type Props = {
  citizen: { fullName: string; cccd: string; unitName: string; receivingUnitCode: string | null };
  units: { code: string; name: string }[];
  quotas: { toUnit: string; amount: number; filled?: number }[];
  currentUnitName: string;
  campaignName: string;
  value: string;
  onChange: (code: string) => void;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();

export default function ReceivingAssignmentModal({ citizen, units, quotas, currentUnitName, campaignName, value, onChange, busy, error, onClose, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const editing = Boolean(citizen.receivingUnitCode);
  const selected = units.find((unit) => unit.code === value);
  const filtered = units.filter((unit) => normalize(`${unit.name} ${unit.code}`).includes(normalize(search.trim())));

  useEffect(() => {
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="assignment-title"
      aria-describedby="assignment-description"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-[640px] overflow-hidden rounded-[28px] border-0 bg-m3-surface-lowest p-0 text-m3-on-surface shadow-[0_24px_80px_rgba(15,23,42,0.24)] backdrop:bg-slate-950/40"
    >
      <form onSubmit={(event) => { event.preventDefault(); if (selected && !busy && value !== citizen.receivingUnitCode) onConfirm(); }} className="flex max-h-[calc(100dvh_-_2rem)] flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-black/[0.06] px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-m3-primary/10 text-m3-primary"><ShieldCheck size={24} /></span>
            <div>
              <h2 id="assignment-title" className="text-lg font-bold tracking-tight">{editing ? "Điều chỉnh đơn vị nhận quân" : "Phân quân về đơn vị"}</h2>
              <p id="assignment-description" className="mt-1 text-[13px] text-m3-on-surface-variant">Chọn đơn vị tiếp nhận cho quân nhân dưới đây.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Đóng phân quân" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-m3-on-surface-variant transition hover:bg-m3-surface-high focus-visible:outline-2 focus-visible:outline-m3-primary disabled:opacity-40"><X size={19} /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
          <div className="rounded-[20px] border border-black/[0.05] bg-m3-surface-low p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-m3-surface-lowest text-m3-on-surface-variant"><UserRound size={21} /></span>
              <div className="min-w-0"><p className="font-bold">{citizen.fullName}</p><p className="mt-0.5 font-mono text-xs text-m3-on-surface-variant">CCCD · {citizen.cccd}</p></div>
            </div>
            <p className="mt-3 flex items-start gap-2 text-[13px] text-m3-on-surface-variant"><MapPin size={15} className="mt-0.5 shrink-0" />{citizen.unitName}</p>
            {campaignName && <p className="mt-2 text-xs text-m3-on-surface-variant">Đợt tuyển quân: {campaignName}</p>}
            {editing && <div className="mt-3 border-t border-black/[0.06] pt-3 text-[13px]"><span className="text-m3-on-surface-variant">Đơn vị hiện tại: </span><span className="font-semibold">{currentUnitName}</span></div>}
          </div>

          <fieldset disabled={busy} className="min-w-0">
            <legend className="mb-3 flex w-full items-center justify-between text-sm font-bold">Đơn vị nhận quân <span className="text-xs font-normal text-m3-on-surface-variant">{units.length} đơn vị</span></legend>
            <div className="relative mb-3">
              <Search size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-m3-on-surface-variant" />
              <input autoFocus type="search" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Tìm đơn vị nhận quân" placeholder="Tìm sư đoàn, trung đoàn…" className="h-11 w-full rounded-xl border border-black/[0.08] bg-m3-surface-lowest pl-10 pr-4 text-sm outline-none transition focus:border-m3-primary focus:ring-2 focus:ring-m3-primary/15" />
            </div>
            <div className="space-y-2">
              {filtered.map((unit) => {
                const quota = quotas.find((q) => q.toUnit === unit.code);
                const remaining = quota ? Math.max(0, quota.amount - (quota.filled ?? 0)) : null;
                const active = unit.code === value;
                return (
                  <label key={unit.code} className={`relative flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition focus-within:ring-2 focus-within:ring-m3-primary/30 ${active ? "border-m3-primary bg-m3-primary/5" : "border-black/[0.08] bg-m3-surface-lowest hover:border-m3-primary/40 hover:bg-m3-surface-low"} ${busy ? "pointer-events-none opacity-60" : ""}`}>
                    <input type="radio" name="receiving-unit" value={unit.code} checked={active} onChange={() => onChange(unit.code)} className="sr-only" />
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-m3-primary/10 text-m3-primary" : "bg-m3-surface-high text-m3-on-surface-variant"}`}><Building2 size={20} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{unit.name}</span>
                      <span className="mt-1 block text-xs text-m3-on-surface-variant">{unit.code}{unit.code === citizen.receivingUnitCode ? " · Đơn vị hiện tại" : ""}</span>
                      {quota && <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-m3-on-surface-variant"><span>Đã phân {quota.filled ?? 0}/{quota.amount}</span><span className={remaining === 0 ? "font-medium text-amber-700" : "font-medium text-emerald-700"}>{remaining === 0 ? "Đã đủ chỉ tiêu" : `Còn ${remaining} chỉ tiêu`}</span></span>}
                    </span>
                    <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? "border-m3-primary bg-m3-primary text-white" : "border-black/20"}`}>{active && <Check size={13} />}</span>
                  </label>
                );
              })}
              {filtered.length === 0 && <div className="rounded-2xl border border-dashed border-black/10 px-5 py-8 text-center"><Building2 size={26} className="mx-auto mb-2 text-m3-on-surface-variant" /><p className="text-sm font-medium">{units.length ? "Không tìm thấy đơn vị phù hợp" : "Chưa có đơn vị nhận quân"}</p><p className="mt-1 text-xs text-m3-on-surface-variant">{units.length ? "Thử tìm bằng tên hoặc mã đơn vị khác." : "Vui lòng kiểm tra danh sách đơn vị nhận quân của quân khu."}</p></div>}
            </div>
          </fieldset>
          {error && <p role="alert" className="rounded-xl bg-m3-error/8 px-4 py-3 text-sm text-m3-error">{error}</p>}
        </div>

        <footer className="shrink-0 border-t border-black/[0.06] bg-m3-surface-low px-5 py-4 sm:px-7">
          <p className="mb-3 flex items-start gap-2 text-[13px] text-m3-on-surface-variant"><ArrowRight size={16} className="mt-0.5 shrink-0" /><span>{selected ? <>Đơn vị tiếp nhận: <strong className="font-semibold text-m3-on-surface">{selected.name}</strong></> : "Chọn một đơn vị để xác nhận phân quân."}</span></p>
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-full border border-black/10 bg-m3-surface-lowest px-5 text-sm font-semibold transition hover:bg-m3-surface-high disabled:opacity-40">Hủy</button>
            <button type="submit" disabled={busy || !selected || value === citizen.receivingUnitCode} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-m3-primary px-5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{busy ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Xác nhận phân quân"}</button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
