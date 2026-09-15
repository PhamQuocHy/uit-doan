import type { Citizen, EducationRecord, HealthRecord, ResidenceRecord } from "@/lib/data";
import { formatVnDate } from "@/lib/date-vn";
import { resolveCitizenAvatarSrc } from "@/lib/citizen-avatar";
import { isRoundTwo } from "@/lib/print-exam-selection";

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
function field(value?: string | number): string {
  const text = value == null || value === "" ? "" : esc(value);
  return `<span class="field${text ? " filled" : ""}">${text || "&nbsp;"}</span>`;
}
export type RegistrationPrintDetails = {
  cityName?: string;
  campaignName?: string;
  education?: EducationRecord[];
  residence?: ResidenceRecord[];
};

export function buildCitizenHealthPrintHtml(citizen: Citizen, record?: HealthRecord, communeName = "", extra: RegistrationPrintDetails = {}): string {
  const health = record?.citizenId === citizen.id ? record : undefined;
  const detail = health?.detail;
  const detailed = health ? isRoundTwo(health) : false;
  const detailedRows = detailed ? [
    ["Cơ sở khám", detail?.facility],
    ["Chiều cao", health?.height ? `${health.height} cm` : ""],
    ["Cân nặng", health?.weight ? `${health.weight} kg` : ""],
    ["Huyết áp", health?.bloodPressure], ["Thị lực (sơ bộ)", health?.vision],
    ["Vòng ngực (cm)", detail?.chestCircumference], ["Mạch", detail?.pulse],
    ["Mắt trái", detail?.visionLeft], ["Mắt phải", detail?.visionRight],
    ["Răng – Hàm – Mặt", detail?.dental], ["Tai – Mũi – Họng", detail?.ent],
    ["Thần kinh", detail?.neurology], ["Nội khoa", detail?.internalMedicine],
    ["Da liễu", detail?.dermatology], ["Ngoại khoa", detail?.surgery], ["Dị tật", detail?.physicalDefects],
    ["Xét nghiệm", detail?.labTests], ["Xét nghiệm máu", detail?.bloodTest],
    ["Xét nghiệm nước tiểu", detail?.urineTest], ["Siêu âm", detail?.ultrasound],
    ["Điện tim", detail?.ecg], ["X-quang ngực", detail?.chestXray],
    ["Sàng lọc ma túy / HIV", detail?.drugHivScreen], ["Ghi chú", health?.note],
    ["Phân loại sức khỏe", health?.conclusion], ["Bác sĩ khám", health?.doctor],
  ].map(([label, value]) => `<tr><td>${esc(label)}</td><td>${esc(value)}</td></tr>`).join("") : "";
  const portrait = citizen.avatar?.trim() ? resolveCitizenAvatarSrc(citizen.avatar) : "";
  const education = (extra.education || []).filter(r => r.citizenId === citizen.id)
    .sort((a, b) => (b.graduationYear || b.startYear || 0) - (a.graduationYear || a.startYear || 0));
  const residence = (extra.residence || []).filter(r => r.citizenId === citizen.id && r.status === "current")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const permanent = residence.find(r => r.type === "Thường trú")?.address || citizen.address;
  const current = residence.find(r => r.type === "Tạm trú")?.address || permanent;
  const rows = education.map(r => `<tr><td>${esc(r.status === "completed" ? r.graduationYear : "")}</td><td>${esc(r.level)}</td><td>${esc(r.major)}</td><td>${esc(r.institution)}</td></tr>`);
  while (rows.length < 3) rows.push("<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>");
  const bmi = health && health.height > 0 && health.weight > 0 ? (health.weight / (health.height / 100) ** 2).toFixed(1) : "";
  const vision = [detail?.visionLeft && `Trái: ${detail.visionLeft}`, detail?.visionRight && `Phải: ${detail.visionRight}`].filter(Boolean).join("; ") || health?.vision;
  const healthRows = [
    ["Mắt", vision], ["Chiều cao", health?.height ? `${health.height} cm` : ""],
    ["Cân nặng", health?.weight ? `${health.weight} kg` : ""], ["BMI", bmi],
    ["Dị tật", detail?.physicalDefects], ["Huyết áp", health?.bloodPressure ? `${health.bloodPressure} mmHg` : ""],
  ].map(([label, value]) => `<tr><td>${label}</td><td>${esc(formatVnDate(health?.createdAt))}</td><td>${esc(value)}</td></tr>`).join("");
  const campaign = extra.campaignName || (health ? [health.phase, health.year ? `năm ${health.year}` : ""].filter(Boolean).join(" ") : "") || "Đợt khám…";
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<title>Hồ sơ đăng ký nghĩa vụ quân sự — ${esc(citizen.fullName)}</title>
<style>
@page { size: A4 portrait; margin: 24mm 20mm 20mm 32mm; }
* { box-sizing: border-box; }
body { margin: 0; background: #e8e8e8; color: #000; font: 11pt "Times New Roman", serif; }
.sheet { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 24mm 20mm 20mm 32mm; background: #fff; }
.header { display: grid; grid-template-columns: 45% 55%; font-weight: bold; padding: 0 4mm; }
.motto { text-align: center; }
.motto span { display: inline-block; border-bottom: 1px solid #000; padding: 0 2mm 1mm; }
h1 { font-size: 12pt; text-align: center; margin: 5mm 0 0; }
.profile { display: grid; grid-template-columns: 34mm minmax(0, 1fr); gap: 5mm; margin-top: 7mm; align-items: start; }
.portrait { width: 34mm; height: 45mm; border: 0.5pt solid #000; }
.portrait img { display: block; width: 100%; height: 100%; object-fit: contain; }
.profile .columns { grid-template-columns: 62% 38%; }
.profile .personal { grid-template-columns: 43% 33% 24%; column-gap: 1mm; }
.personal .line { font-size: 10pt; }
.profile .line { font-size: 10.5pt; }
.subtitle { text-align: center; font-style: italic; margin: 0 0 4mm; }
h2 { font-size: 11pt; margin: 2mm 0 0; }
.line { display: flex; gap: 1mm; align-items: baseline; min-height: 6.4mm; line-height: 1.55; }
.columns { display: grid; grid-template-columns: 55% 45%; }
.parents { grid-template-columns: 47% 53%; }
.identity { display: grid; grid-template-columns: 37% 22% 41%; margin-top: 1mm; }
.identity .line { font-size: 10pt; }
.identity .filled { white-space: nowrap; overflow-wrap: normal; }
.field { flex: 1; display: inline-block; min-width: 6mm; border-bottom: 1px dotted #555; line-height: 1.3; overflow-wrap: anywhere; white-space: pre-wrap; }
.filled { border-bottom-color: transparent; }
.service { display: block; }
.service .field { min-width: 16mm; }
.checkbox { display: inline-block; width: 2.4mm; height: 2.4mm; border: 0.5pt solid #555; margin-right: 1.5mm; vertical-align: baseline; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { border: 0.5pt solid #555; padding: 0.6mm 1.7mm; overflow-wrap: anywhere; vertical-align: middle; }
th { font-weight: bold; text-align: center; }
tr { break-inside: avoid; }
thead { display: table-header-group; }
.education td { height: 6.5mm; }
.education th { height: 12mm; }
.health-title { margin-top: 4mm; }
.health td, .health th { height: 5.6mm; }
.signature { break-inside: avoid; }
.date { text-align: right; margin: 2mm 0; }
.signers td { width: 50%; border: 0; text-align: center; padding: 1mm; }
.round-two { break-before: page; page-break-before: always; padding-top: 5mm; }
.round-two h1 { margin: 0 0 5mm; }
.round-two td { min-height: 6mm; white-space: pre-wrap; }
@media print { body { background: white; } .sheet { width: auto; min-height: 0; margin: 0; padding: 0; } }
</style></head><body><main class="sheet">
<div class="header"><div><div class="line">Thành phố${field(extra.cityName)}</div><div class="line">Xã${field(communeName)}</div></div>
<div class="motto">Cộng hoà xã hội chủ nghĩa việt nam<br><span>Độc lập - Tự do - Hạnh phúc</span></div></div>
<div class="profile"><div class="portrait">${portrait ? `<img src="${esc(portrait)}" alt="Ảnh chân dung công dân">` : ""}</div><div>
<h1>HỒ SƠ ĐĂNG KÝ NGHĨA VỤ QUÂN SỰ</h1><p class="subtitle">(V/v ${esc(campaign)})</p>
<h2>I. Sơ yếu lý lịch</h2>
<div class="columns personal"><div class="line">Họ và tên: ${field(citizen.fullName)}</div><div class="line">Sinh ngày: ${field(formatVnDate(citizen.dateOfBirth))}</div><div class="line">Giới tính: ${field(citizen.gender === "male" ? "Nam" : citizen.gender === "female" ? "Nữ" : "")}</div></div>
<div class="columns parents"><div class="line">Họ và tên bố: ${field(citizen.fatherName)}</div><div class="line">Năm sinh: ${field()}</div></div>
<div class="columns parents"><div class="line">Họ và tên mẹ: ${field(citizen.motherName)}</div><div class="line">Năm sinh: ${field()}</div></div>
</div></div>
<div class="identity"><div class="line">Căn cước công dân số: ${field(citizen.cccd)}</div><div class="line">Cấp ngày: ${field(formatVnDate(citizen.issueDate))}</div><div class="line">Nơi Cấp: Cục cảnh sát QLHC về TTXH.</div></div>
<div class="line service"><span class="checkbox" aria-label="Chưa đánh dấu"></span>Chưa tham gia nghĩa vụ quân sự.</div>
<div class="line service"><span class="checkbox" aria-label="Chưa đánh dấu"></span>Đã phục vụ tại ngũ từ <i>(tháng/năm)</i> ${field()} đến <i>(tháng/năm)</i> ${field()}</div>
<h2>II. Thông tin cư trú:</h2>
<div class="line">Nguyên quán: ${field(citizen.originPlace)}</div>
<div class="line">Địa chỉ thường trú: ${field(permanent)}</div>
<div class="line">Nơi ở hiện tại: ${field(current)}</div>
<h2>III. Trình độ học vấn</h2>
<table class="education"><colgroup><col style="width:14%"><col style="width:19%"><col style="width:32%"><col style="width:35%"></colgroup><thead><tr><th>Năm<br>tốt nghiệp</th><th>Trình độ</th><th>Ngành học</th><th>Tên trường</th></tr></thead><tbody>${rows.join("")}</tbody></table>
<h2 class="health-title">II. Kết quả kiểm tra sức khỏe:</h2>
<table class="health"><colgroup><col style="width:17%"><col style="width:22%"><col style="width:61%"></colgroup><thead><tr><th>Loại khám</th><th>Ngày khám</th><th>Tình trạng</th></tr></thead><tbody>${healthRows}</tbody></table>
<div class="line">${detailed ? "Phân loại sức khỏe" : "Phân loại sức khỏe sơ bộ"}: ${field(health?.conclusion)}</div>
<div class="signature"><p class="date">........., ngày....., tháng....., năm..........</p>
<table class="signers"><tbody><tr><td>Bác sĩ khám<br><i>(Ký và ghi rõ họ tên)</i></td><td>Cán bộ thực hiện<br><i>(Ký và ghi rõ họ tên)</i></td></tr></tbody></table></div>
${detailed ? `<section class="round-two"><h1>VÒNG 2 — KẾT QUẢ KHÁM CHI TIẾT</h1>
<div class="line">Họ và tên: ${field(citizen.fullName)} &nbsp; CCCD: ${field(citizen.cccd)}</div>
<div class="line">Năm khám: ${field(health?.year)} &nbsp; Ngày khám: ${field(formatVnDate(health?.createdAt))}</div>
<table><colgroup><col style="width:35%"><col style="width:65%"></colgroup><thead><tr><th>Nội dung khám</th><th>Kết quả</th></tr></thead><tbody>${detailedRows}</tbody></table>
<div class="signature"><p class="date">........., ngày....., tháng....., năm..........</p><table class="signers"><tbody><tr><td>Bác sĩ khám<br><i>(Ký và ghi rõ họ tên)</i></td><td>Cán bộ thực hiện<br><i>(Ký và ghi rõ họ tên)</i></td></tr></tbody></table></div></section>` : ""}
</main></body></html>`;
}
