import type { CitizenData, FieldMismatch, VerificationResult } from "./types";

const COMPARE_FIELDS: (keyof CitizenData)[] = [
  "fullName",
  "personalId",
  "dateOfBirth",
  "gender",
  "nationality",
  "placeOfOrigin",
  "placeOfResidence",
];

function normalize(field: string, value: unknown): string {
  const raw = String(value ?? "")
    .normalize("NFC")
    .trim();
  if (!raw) return "";

  if (field === "personalId") {
    return raw.replace(/\D/g, "");
  }
  if (field === "dateOfBirth") {
    const digits = raw.replace(/\D/g, "");
    if (/^\d{8}$/.test(digits)) {
      if (digits.startsWith("19") || digits.startsWith("20")) {
        return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
      }
      return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  }
  if (field === "gender") {
    const v = raw.toLowerCase();
    if (["nam", "male", "m", "1"].includes(v)) return "male";
    if (["nữ", "nu", "female", "f", "2"].includes(v)) return "female";
    return v;
  }
  if (field === "fullName" || field === "nationality" || field === "placeOfOrigin" || field === "placeOfResidence") {
    return raw.replace(/\s+/g, " ").toUpperCase();
  }
  return raw;
}

export function compareNfcAndOcr(
  nfc: Partial<CitizenData> | Record<string, unknown> | null | undefined,
  ocr: Partial<CitizenData> | Record<string, unknown> | null | undefined,
): VerificationResult {
  const mismatches: FieldMismatch[] = [];
  for (const field of COMPARE_FIELDS) {
    const nfcVal = normalize(field, nfc?.[field]);
    const ocrVal = normalize(field, ocr?.[field]);
    if (!nfcVal || !ocrVal) continue;
    if (nfcVal !== ocrVal) {
      mismatches.push({
        field,
        nfc: String(nfc?.[field] ?? ""),
        ocr: String(ocr?.[field] ?? ""),
      });
    }
  }
  const hasId =
    Boolean(normalize("personalId", nfc?.personalId)) &&
    Boolean(normalize("personalId", ocr?.personalId));
  return {
    matched: mismatches.length === 0 && hasId,
    mismatches,
  };
}
