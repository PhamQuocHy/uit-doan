"use client";

import ExcelExportButton from "./ExcelExportButton";
import { fetchExportRows } from "@/lib/excel-export";

type ReceivingRow = {
  fullName: string; cccd: string; dateOfBirth?: string; unitName: string;
  healthResult?: string; receivingStatus: string; receivingUnitName?: string;
};
const labels: Record<string, string> = {
  chua_phan_quan: "Chưa phân quân", da_phan_quan: "Đã phân đơn vị",
  submitted_to_bo: "Đã gửi Bộ", bo_approved: "Bộ đã duyệt",
  published: "Đã công bố", unit_confirmed: "Đã xác nhận nhận quân",
};

export default function ReceivingExcelButton({ campaignId, status = "", unitCode = "", quanKhuCode = "" }: {
  campaignId: string; status?: string; unitCode?: string; quanKhuCode?: string;
}) {
  return <ExcelExportButton filename={`danh-sach-phan-quan-${campaignId}`} disabled={!campaignId}
    getSheets={async (onProgress) => {
      const params = new URLSearchParams({ campaignId, status, unitCode, quanKhuCode });
      const rows = await fetchExportRows<ReceivingRow>(`/api/admin/receiving?${params}`, onProgress);
      return [{ name: "Danh sách phân quân", headers: ["STT", "Họ và tên", "CCCD", "Ngày sinh", "Địa phương", "Loại sức khỏe", "Đơn vị nhận quân", "Trạng thái"],
        rows: rows.map((r, i) => [i + 1, r.fullName, r.cccd, r.dateOfBirth, r.unitName, r.healthResult, r.receivingUnitName, labels[r.receivingStatus] || r.receivingStatus]),
      }];
    }} />;
}
