import * as XLSX from "xlsx";
import type { ExcelSheet } from "./excel-export";

self.onmessage = ({ data: sheets }: MessageEvent<ExcelSheet[]>) => {
  try {
    const workbook = XLSX.utils.book_new();
    for (const sheet of sheets) {
      self.postMessage({ progress: { stage: "building", sheet: sheet.name } });
      const worksheet = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
      worksheet["!cols"] = sheet.headers.map((header, i) => ({
        wch: sheet.columnWidths?.[i] ?? Math.min(55, Math.max(14, header.length + 2, ...sheet.rows.slice(0, 200).map(row => String(row[i] ?? "").length + 2))),
      }));
      if (sheet.autoFilter !== false && worksheet["!ref"]) worksheet["!autofilter"] = { ref: worksheet["!ref"] };
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    }
    self.postMessage({ progress: { stage: "building" } });
    const buffer: ArrayBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true });
    self.postMessage({ buffer }, { transfer: [buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Không thể tạo file Excel." });
  }
};
