"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { downloadExcel, type ExcelSheet, type ExcelProgress, type OnExcelProgress } from "@/lib/excel-export";

export default function ExcelExportButton({ filename, getSheets, disabled = false }: {
  filename: string;
  getSheets: (onProgress: OnExcelProgress) => Promise<ExcelSheet[]>;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [progress, setProgress] = useState<ExcelProgress>({ stage: "loading" });
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!busy || !dialog) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
    };
  }, [busy]);
  async function run() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setProgress({ stage: "loading" });
    setError("");
    try {
      const sheets = await getSheets(setProgress);
      if (!sheets.some(sheet => sheet.rows.length)) throw new Error("Không có dữ liệu để xuất Excel.");
      setProgress({ stage: "building" });
      await downloadExcel(filename, sheets, setProgress);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể xuất Excel. Vui lòng thử lại.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return <div>
    <button type="button" onClick={run} disabled={disabled || busy}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 text-[13px] font-semibold text-m3-on-surface hover:bg-m3-surface-high disabled:opacity-50">
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
      {busy ? "Đang xuất…" : "Xuất Excel"}
    </button>
    {error && <p role="alert" className="mt-1 text-xs text-m3-error">{error}</p>}
    <dialog ref={dialogRef} aria-labelledby={titleId} aria-modal="true"
      onCancel={event => event.preventDefault()}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-[28px] border-0 bg-m3-surface-lowest p-7 text-m3-on-surface shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm">
      <div aria-busy={busy} className="text-center">
        <Loader2 size={36} aria-hidden="true" className="mx-auto mb-4 animate-spin text-m3-primary" />
        <h2 id={titleId} className="text-lg font-semibold">Đang xuất Excel</h2>
        <div role="status" aria-live="polite" className="mt-3 text-sm text-m3-on-surface-variant">
          <p>{progress.stage === "loading" ? "Đang tải dữ liệu…" : progress.stage === "saving" ? "Đang tải file về máy…" : progress.sheet ? `Đang tạo trang tính: ${progress.sheet}` : "Đang tạo và nén file Excel…"}</p>
          {progress.stage === "loading" && progress.loaded !== undefined && <p className="mt-2 font-medium">
            Đã tải {progress.loaded.toLocaleString("vi-VN")} bản ghi
            {Boolean(progress.totalPages) && ` · Trang ${progress.page}/${progress.totalPages}`}
          </p>}
        </div>
        {progress.stage === "loading" && Boolean(progress.totalPages) && <progress
          aria-label="Tiến trình tải dữ liệu" max={progress.totalPages} value={progress.page}
          className="mt-4 h-2 w-full accent-m3-primary" />}
        <p className="mt-4 text-xs text-m3-on-surface-variant">Dữ liệu lớn có thể mất vài phút. Vui lòng giữ trang này mở đến khi tải file.</p>
      </div>
    </dialog>
  </div>;
}
