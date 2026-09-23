import type { AnalyticsDashboard, OverviewKpi } from "./types";
import type { ExcelSheet } from "../excel-export";

const overviewLabels: Record<keyof OverviewKpi, string> = {
  totalCitizens: "Tổng công dân", availableForDraft: "Sẵn sàng tuyển quân",
  deferred: "Tạm hoãn", exempted: "Miễn gọi", inService: "Tại ngũ",
  examining: "Đang khám", passed: "Đạt tuyển", unassignedReceiving: "Chưa phân quân",
  assignedReceiving: "Đã phân đơn vị nhận quân",
};

export function reportExcelSheets(data: AnalyticsDashboard): ExcelSheet[] {
  const sheets: ExcelSheet[] = [
    { name: "Thông tin", headers: ["Thông tin", "Giá trị"], rows: [
      ["Năm", data.meta.year ?? "Tất cả"], ["Mã đơn vị", data.meta.unitCode],
      ["Thời điểm tổng hợp (giờ Việt Nam)", new Date(data.meta.generatedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })], ["Nguồn dữ liệu", data.meta.source === "mysql" ? "Cơ sở dữ liệu" : "Dữ liệu demo"],
      ["Cỡ mẫu tương quan", data.correlations.sampleSize],
    ] },
    { name: "Tổng quan", headers: ["Chỉ số", "Số lượng"], rows: (Object.keys(overviewLabels) as (keyof OverviewKpi)[]).map(k => [overviewLabels[k], data.overview[k]]) },
    { name: "Theo năm", headers: ["Năm", "Gọi khám", "Đạt tuyển", "Nhập ngũ", "Không đạt", "Tạm hoãn"], rows: data.recruitmentStatsByYear.map(r => [r.year, r.called, r.passed, r.enlisted, r.failed, r.deferred]) },
    { name: "Tạm hoãn", headers: ["Lý do", "Số lượng", "Tỷ lệ (%)"], rows: data.defermentReasons.map(r => [r.label, r.value, r.percentage]) },
    { name: "Tiến trình tuyển quân", headers: ["Giai đoạn", "Số lượng"], rows: data.funnel.map(r => [r.label, r.count]) },
    { name: "Chỉ tiêu", headers: ["Mã đơn vị", "Đơn vị", "Chỉ tiêu", "Đã thực hiện", "Tỷ lệ (%)"], rows: data.quotas.map(r => [r.unitCode, r.unitName, r.amount, r.filled, r.fillRate]) },
    { name: "Địa bàn", headers: ["Mã đơn vị", "Đơn vị", "Tổng số", "Đạt", "Tỷ lệ đạt (%)"], rows: data.unitQualifyRates.map(r => [r.unitCode, r.unitName, r.total, r.qualified, r.qualifyRate]) },
    { name: "Học vấn và sức khỏe", headers: ["Học vấn", "Sức khỏe", "Số lượng"], rows: data.educationVsHealth.map(r => [r.row, r.col, r.count]) },
    { name: "Sức khỏe theo năm", headers: ["Năm", "Sức khỏe", "Số lượng"], rows: data.healthGradeByYear.map(r => [r.row, r.col, r.count]) },
    { name: "Tương quan", headers: ["Chỉ số", ...data.correlations.labels], rows: data.correlations.matrix.map((row, i) => [data.correlations.labels[i], ...row]) },
  ];
  const summary: ExcelSheet = {
    name: "Báo cáo tổng hợp",
    headers: ["BÁO CÁO THỐNG KÊ NGHĨA VỤ QUÂN SỰ", "", "", "", "", ""],
    autoFilter: false,
    columnWidths: [52, 38, 22, 22, 22, 22],
    rows: [
      ...sheets[0].rows,
      ["Hướng dẫn", "Các bảng dưới đây tổng hợp số liệu; xem các trang tính riêng để lọc và đối chiếu."],
      ["Lưu ý", "Các chỉ số có thể chồng lấp; không cộng tất cả chỉ số thành tổng công dân."],
    ],
  };
  for (const [index, sheet] of sheets.slice(1).entries()) {
    summary.rows.push([], [`${index + 1}. ${sheet.name.toLocaleUpperCase("vi-VN")}`], sheet.headers);
    if (sheet.rows.length) {
      for (const row of sheet.rows) summary.rows.push(row);
    } else {
      summary.rows.push(["Chưa có dữ liệu trong phạm vi báo cáo"]);
    }
  }
  // Open on the actual report, while retaining separate tables for filtering.
  return [summary, ...sheets.slice(1), sheets[0]];
}
