import { test } from "node:test";
import assert from "node:assert/strict";
import type { Citizen, EducationRecord, HealthRecord, ResidenceRecord } from "./data";
import { buildCitizenHealthPrintHtml } from "./citizen-health-print";

const citizen = { id: "print-citizen", fullName: "Nguyễn Văn An", cccd: "012345678901", dateOfBirth: "2005-05-12" } as Citizen;
test("prints the supplied health record and calendar date without inventing missing history", () => {
  const html = buildCitizenHealthPrintHtml(citizen, { citizenId: citizen.id, height: 171, weight: 63, conclusion: "Loại 2" } as HealthRecord);
  for (const text of ["12/05/2005", "171", "63", "Loại 2", "I. Sơ yếu lý lịch", "II. Kết quả kiểm tra sức khỏe:", "size: A4 portrait"]) assert.ok(html.includes(text));
  assert.ok(!html.includes("undefined"));
  assert.ok(!html.includes("Không có bệnh"));
});
test("never includes a different citizen's health results", () => {
  const html = buildCitizenHealthPrintHtml(citizen, { citizenId: "another-citizen", conclusion: "Loại 6" } as HealthRecord);
  assert.ok(!html.includes("Loại 6"));
});
test("escapes identity and clinical text in the standalone print document", () => {
  const html = buildCitizenHealthPrintHtml({ ...citizen, fullName: '<script>alert("test")</script>' });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("revised dossier includes residence, education and both signature columns", () => {
  const html = buildCitizenHealthPrintHtml(citizen, undefined, "Phú Lộc", {
    education: [
      { citizenId: citizen.id, status: "completed", graduationYear: 2025, level: "Đại học", major: "Công nghệ thông tin", institution: "Trường minh họa" } as EducationRecord,
      { citizenId: "other", institution: "PRIVATE OTHER SCHOOL" } as EducationRecord,
    ],
    residence: [
      { citizenId: citizen.id, status: "current", type: "Thường trú", address: "Địa chỉ thường trú mẫu", updatedAt: "2026-01-01" } as ResidenceRecord,
      { citizenId: citizen.id, status: "current", type: "Tạm trú", address: "Địa chỉ hiện tại mẫu", updatedAt: "2026-02-01" } as ResidenceRecord,
    ],
  });
  for (const text of ["HỒ SƠ ĐĂNG KÝ NGHĨA VỤ QUÂN SỰ", "Thông tin cư trú", "Trình độ học vấn", "2025", "Công nghệ thông tin", "Trường minh họa", "Địa chỉ hiện tại mẫu", "Địa chỉ thường trú mẫu", "Bác sĩ khám", "Cán bộ thực hiện", citizen.cccd]) assert.ok(html.includes(text), text);
  assert.ok(!html.includes("PRIVATE OTHER SCHOOL"));
  assert.ok(!html.includes("Tổ trưởng"));
});

test("portrait frame uses the citizen photo and stays empty without a photo", () => {
  const html = buildCitizenHealthPrintHtml({ ...citizen, avatar: "uploads/avatars/test-photo.jpg" });
  assert.ok(html.includes('src="/uploads/avatars/test-photo.jpg"'));
  assert.ok(html.includes('class="portrait"'));
  assert.ok(html.includes("object-fit: contain"));
  const blank = buildCitizenHealthPrintHtml(citizen);
  assert.ok(blank.includes('<div class="portrait"></div>'));
  assert.ok(!blank.includes("ui-avatars.com"));
});
