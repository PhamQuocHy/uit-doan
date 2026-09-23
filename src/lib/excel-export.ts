export type ExcelSheet = {
  name: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  autoFilter?: boolean;
  columnWidths?: number[];
};
export type ExcelProgress = {
  stage: "loading" | "building" | "saving";
  loaded?: number;
  page?: number;
  totalPages?: number;
  sheet?: string;
};
export type OnExcelProgress = (progress: ExcelProgress) => void;

export async function downloadExcel(filename: string, sheets: ExcelSheet[], onProgress?: OnExcelProgress) {
  // Build/compress off the UI thread so the loading dialog remains responsive.
  const worker = new Worker(new URL("./excel-export.worker.ts", import.meta.url));
  try {
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      worker.onmessage = ({ data }) => {
        if (data.error) reject(new Error(data.error));
        else if (data.buffer) resolve(data.buffer);
        else if (data.progress) onProgress?.(data.progress);
      };
      worker.onerror = () => reject(new Error("Không thể tạo file Excel. Vui lòng thử lại."));
      worker.onmessageerror = () => reject(new Error("Không đọc được dữ liệu file Excel."));
      worker.postMessage(sheets);
    });
    onProgress?.({ stage: "saving" });
    const url = URL.createObjectURL(new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename.replace(/[\\/:*?"<>|]/g, "-")}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } finally {
    worker.terminate();
  }
}

export async function fetchExportRows<T>(endpoint: string, onProgress?: OnExcelProgress): Promise<T[]> {
  const url = new URL(endpoint, window.location.origin);
  url.searchParams.set("limit", "500");
  const rows: T[] = [];
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page++) {
    url.searchParams.set("page", String(page));
    const response = await fetch(url, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Không tải được dữ liệu xuất Excel");
    if (!Array.isArray(result.data)) throw new Error("Dữ liệu xuất Excel không hợp lệ");
    rows.push(...result.data);
    totalPages = result.totalPages ?? 1;
    onProgress?.({ stage: "loading", loaded: rows.length, page, totalPages });
  }
  return rows;
}
