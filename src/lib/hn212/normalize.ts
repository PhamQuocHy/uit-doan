import type { Hn212CitizenScan } from "./types";
import { asRec } from "./utils";

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | null {
  return asRec(value);
}

function pickString(obj: AnyRecord | null, keys: string[]): string {
  if (!obj) return "";
  for (const key of keys) {
    const direct = obj[key];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    if (typeof direct === "number" && Number.isFinite(direct)) {
      return String(direct);
    }
    const found = Object.keys(obj).find(
      (k) => k.toLowerCase() === key.toLowerCase(),
    );
    if (found) {
      const v = obj[found];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
  }
  return "";
}

function dig(obj: AnyRecord | null, paths: string[][]): AnyRecord | null {
  if (!obj) return null;
  for (const path of paths) {
    let cur: unknown = obj;
    let ok = true;
    for (const part of path) {
      const rec = asRecord(cur);
      if (!rec) {
        ok = false;
        break;
      }
      cur =
        rec[part] ??
        rec[
          Object.keys(rec).find((k) => k.toLowerCase() === part.toLowerCase()) ??
            ""
        ];
    }
    if (ok) {
      const rec = asRecord(cur);
      if (rec) return rec;
    }
  }
  return null;
}

/** Parse dd/MM/yyyy, dd-MM-yyyy, yyyy-MM-dd → yyyy-MM-dd */
export function parseVnDate(input: string): string {
  const s = input.trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const dd = m[1]!.padStart(2, "0");
    const mm = m[2]!.padStart(2, "0");
    const yyyy = m[3]!;
    return `${yyyy}-${mm}-${dd}`;
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${day}`;
  }
  return "";
}

function parseGender(raw: string): "male" | "female" | undefined {
  const s = raw.trim().toLowerCase();
  if (!s) return undefined;
  if (["nam", "male", "m", "1", "true"].includes(s) || s.includes("nam")) {
    return "male";
  }
  if (
    ["nữ", "nu", "female", "f", "0", "2"].includes(s) ||
    s.includes("nữ") ||
    s.includes("nu")
  ) {
    return "female";
  }
  return undefined;
}

const ID_KEYS =
  /^(documentnumber|idnumber|citizenpid|personalid|sodinhdanh|identitynumber|cccd|pid)$/i;

const NAME_KEYS =
  /^(personname|hoten|fullname|citizenname|fullname)$/i;

const SKIP_VALUE_KEYS =
  /framedata|facedata|imgdata|chipface|photo|image|portrait|sod|dscert|readerserial|serialnumber/i;

/** CCCD 12 số hoặc CMND 9 số */
function looksLikeVnId(value: string): boolean {
  const s = value.replace(/\s+/g, "");
  return /^\d{12}$/.test(s) || /^\d{9}$/.test(s);
}

function normalizeCccd(value: string): string {
  const digits = value.replace(/\D/g, "");
  // JSON numeric fields lose a leading zero; Vietnamese CCCD is always 12 digits.
  return digits.length === 11 ? digits.padStart(12, "0") : digits;
}

/**
 * MRZ CCCD VN (TD1): dòng 1 thường có số định danh sau VNM.
 * Ví dụ: IDVNM079098012345<<<<<<<<<<<<<<<
 */
export function parseDg1Mrz(dg1: string): { cccd?: string; fullName?: string } {
  const cleaned = dg1.replace(/\s+/g, "").toUpperCase();
  if (!cleaned || cleaned.length < 20) return {};

  const lines = dg1
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let cccd = "";
  const m = cleaned.match(/VNM(\d{9,12})/);
  if (m) cccd = m[1]!;
  if (!cccd) {
    const digits = cleaned.match(/(\d{12})/);
    if (digits) cccd = digits[1]!;
  }

  let fullName = "";
  const nameLine =
    lines.find((l) => l.includes("<<")) ||
    lines[2] ||
    "";
  if (nameLine.includes("<<")) {
    fullName = nameLine
      .replace(/</g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return {
    cccd: cccd || undefined,
    fullName: fullName || undefined,
  };
}

/** Parse mọi chuỗi JSON lồng trong object */
function inflateJsonStrings(obj: AnyRecord, depth = 0) {
  if (depth > 5) return;
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      const t = value.trim();
      if (
        (t.startsWith("{") && t.endsWith("}")) ||
        (t.startsWith("[") && t.endsWith("]"))
      ) {
        try {
          obj[key] = JSON.parse(t);
        } catch {
          /* ignore */
        }
      }
    }
    const nested = asRecord(obj[key]);
    if (nested) inflateJsonStrings(nested, depth + 1);
  }
}

/**
 * Duyệt cây JSON tìm số CCCD/CMND theo tên field hoặc giá trị 9/12 số.
 */
function extractIdFromTree(
  node: unknown,
  depth = 0,
): { cccd: string; fullName: string } {
  if (depth > 8) return { cccd: "", fullName: "" };
  const rec = asRecord(node);
  if (!rec) return { cccd: "", fullName: "" };

  let cccd = "";
  let fullName = "";

  for (const [key, value] of Object.entries(rec)) {
    if (SKIP_VALUE_KEYS.test(key)) continue;

    if (typeof value === "string" || typeof value === "number") {
      const s = String(value).trim();
      if (!s) continue;

      if (/^dg1$/i.test(key)) {
        const mrz = parseDg1Mrz(s);
        if (mrz.cccd && !cccd) cccd = mrz.cccd;
        if (mrz.fullName && !fullName) fullName = mrz.fullName;
      }

      if (!cccd && ID_KEYS.test(key) && looksLikeVnId(s)) {
        cccd = s.replace(/\s+/g, "");
      }
      if (
        !cccd &&
        /document|identity|citizen|personal|cccd|dinhdanh|idnumber/i.test(key) &&
        looksLikeVnId(s)
      ) {
        cccd = s.replace(/\s+/g, "");
      }
      // Giá trị thuần 12 số trên field lạ (trừ serial máy)
      if (!cccd && looksLikeVnId(s) && !/serial|reader|face|hanel/i.test(key)) {
        if (/^\d{12}$/.test(s.replace(/\s+/g, ""))) {
          cccd = s.replace(/\s+/g, "");
        }
      }

      if (!fullName && NAME_KEYS.test(key) && s.length >= 2) {
        // Tránh nhầm tên thiết bị / event
        if (!/^HANEL/i.test(s) && !/ready|connected|success/i.test(s)) {
          fullName = s;
        }
      }
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const hit = extractIdFromTree(item, depth + 1);
        if (hit.cccd && !cccd) cccd = hit.cccd;
        if (hit.fullName && !fullName) fullName = hit.fullName;
      }
      continue;
    }

    if (value && typeof value === "object") {
      const hit = extractIdFromTree(value, depth + 1);
      if (hit.cccd && !cccd) cccd = hit.cccd;
      if (hit.fullName && !fullName) fullName = hit.fullName;
    }
  }

  return { cccd, fullName };
}

function findIdentityRecord(
  root: AnyRecord,
  depth = 0,
): AnyRecord | null {
  if (depth > 6) return null;
  const cccd = pickString(root, [
    "DocumentNumber",
    "documentNumber",
    "IdNumber",
    "cccd",
    "CCCD",
    "CitizenPid",
    "SoDinhDanh",
  ]);
  const name = pickString(root, [
    "PersonName",
    "personName",
    "HoTen",
    "FullName",
    "fullName",
    "FatherName",
    "MotherName",
  ]);
  if (cccd || name) return root;

  for (const value of Object.values(root)) {
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        const rec = asRecord(item);
        if (!rec) continue;
        const hit = findIdentityRecord(rec, depth + 1);
        if (hit) return hit;
      }
      continue;
    }
    const rec = asRecord(value);
    if (!rec) continue;
    if (typeof rec.FrameData === "string" || typeof rec.FaceData === "string") {
      continue;
    }
    const hit = findIdentityRecord(rec, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/** Tìm chuỗi theo tên field ở bất kỳ tầng nào */
function pickDeepString(raw: unknown, keys: string[], depth = 0): string {
  if (depth > 8) return "";
  const rec = asRecord(raw);
  if (!rec) return "";
  const direct = pickString(rec, keys);
  if (direct) return direct;
  for (const [k, value] of Object.entries(rec)) {
    if (SKIP_VALUE_KEYS.test(k)) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        const hit = pickDeepString(item, keys, depth + 1);
        if (hit) return hit;
      }
      continue;
    }
    if (value && typeof value === "object") {
      const hit = pickDeepString(value, keys, depth + 1);
      if (hit) return hit;
    }
  }
  return "";
}

function unwrapPayload(raw: unknown): AnyRecord | null {
  let root = asRecord(raw);
  if (!root) return null;

  // ComQ đôi khi gửi { id, data: {...} } không có EventName
  const dataNode = asRecord(root.data) ?? asRecord(root.Data);
  if (dataNode && (root.id != null || root.Id != null || !root.EventName)) {
    const hasIdFields =
      pickString(dataNode, ["DocumentNumber", "PersonName", "FatherName"]) ||
      asRecord(dataNode.IdCard) ||
      asRecord(dataNode.PersonalInfo) ||
      asRecord(dataNode.PersonalIdentification);
    if (hasIdFields || Object.keys(dataNode).length > 2) {
      root = { ...dataNode, EventName: root.EventName, Message: root.Message };
    }
  }

  inflateJsonStrings(root);

  const nested = dig(root, [
    ["data"],
    ["Data"],
    ["result"],
    ["Result"],
    ["citizen"],
    ["Citizen"],
    ["card"],
    ["Card"],
    ["CardData"],
    ["cardData"],
    ["CardFullData"],
    ["cardFullData"],
    ["CardResult"],
    ["cardResult"],
    ["CardResultInfo"],
    ["cardResultInfo"],
    ["CARD_RESULT"],
    ["IdCard"],
    ["idCard"],
    ["IdCard", "PersonalInfo"],
    ["IdCard", "PersonalIdentification"],
    ["IdCard", "personalInfo"],
    ["idCard", "personalInfo"],
    ["PersonalInfo"],
    ["personalInfo"],
    ["PersonalIdentification"],
    ["personalIdentification"],
    ["Dg1"],
    ["dg1"],
    ["DG1"],
    ["payload"],
    ["Payload"],
    ["info"],
    ["Info"],
    ["person"],
    ["Person"],
  ]);

  const deepHit = findIdentityRecord(root);
  const candidate = deepHit ?? nested ?? root;
  const extracted = extractIdFromTree(root);

  if (extracted.cccd || extracted.fullName) {
    return {
      ...candidate,
      DocumentNumber: extracted.cccd || pickString(candidate, ["DocumentNumber"]),
      PersonName: extracted.fullName || pickString(candidate, ["PersonName", "Name"]),
      _extractedCccd: extracted.cccd,
      _extractedName: extracted.fullName,
    };
  }

  const cccd = pickString(candidate, [
    "cccd",
    "CCCD",
    "IdNumber",
    "DocumentNumber",
    "documentNumber",
    "CitizenPid",
    "SoDinhDanh",
  ]);
  if (
    cccd ||
    pickString(candidate, ["HoTen", "fullName", "FullName", "PersonName"])
  ) {
    return candidate;
  }

  if (
    String(root.EventName || "").toUpperCase() === "CARD_RESULT" ||
    /read successfully/i.test(String(root.Message || ""))
  ) {
    return candidate;
  }

  return root;
}

/** Decode base64 → bytes (browser + Node). */
function b64ToBytes(b64: string): Uint8Array | null {
  try {
    const clean = b64.replace(/\s+/g, "");
    if (typeof atob === "function") {
      const bin = atob(clean);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    if (typeof Buffer !== "undefined") {
      return new Uint8Array(Buffer.from(clean, "base64"));
    }
  } catch {
    /* ignore */
  }
  return null;
}

function bytesToB64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(sub) as number[]);
  }
  return btoa(binary);
}

/** Tách JPEG nhúng trong JP2 / ASN.1 DG2 (tìm FF D8 … FF D9). */
function extractEmbeddedJpeg(bytes: Uint8Array): Uint8Array | null {
  let start = -1;
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  let end = -1;
  for (let i = bytes.length - 2; i > start; i--) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
      end = i + 2;
      break;
    }
  }
  if (end < 0 || end - start < 100) return null;
  return bytes.subarray(start, end);
}

function valueToBase64Candidate(value: unknown): string {
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return "";
    const dataMatch = s.match(/^data:image\/[\w+.-]+;base64,(.+)$/i);
    if (dataMatch) return dataMatch[1]!.replace(/\s+/g, "");
    // Hex dump?
    if (/^[0-9a-fA-F\s]+$/.test(s) && s.replace(/\s/g, "").length > 200) {
      try {
        const hex = s.replace(/\s/g, "");
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        }
        return bytesToB64(bytes);
      } catch {
        /* fallthrough */
      }
    }
    return s.replace(/\s+/g, "");
  }
  if (Array.isArray(value) && value.length > 50 && value.every((n) => typeof n === "number")) {
    return bytesToB64(Uint8Array.from(value as number[]));
  }
  const rec = asRecord(value);
  if (rec) {
    for (const k of [
      "Base64",
      "base64",
      "Data",
      "data",
      "Value",
      "value",
      "Image",
      "image",
      "Bytes",
      "bytes",
    ]) {
      const inner = valueToBase64Candidate(rec[k]);
      if (inner) return inner;
    }
  }
  return "";
}

/**
 * Chuẩn hóa về data URL trình duyệt đọc được (JPEG/PNG/WEBP).
 * DG2 JPEG2000 → cố gắng tách JPEG nhúng; không được thì bỏ.
 */
export function toPortraitDataUrl(raw: unknown): string {
  const b64in = valueToBase64Candidate(raw);
  if (!b64in || b64in.length < 80) return "";

  if (b64in.startsWith("/9j/")) return `data:image/jpeg;base64,${b64in}`;
  if (b64in.startsWith("iVBOR")) return `data:image/png;base64,${b64in}`;
  if (b64in.startsWith("UklGR")) return `data:image/webp;base64,${b64in}`;
  if (b64in.startsWith("Qk")) return `data:image/bmp;base64,${b64in}`;

  const bytes = b64ToBytes(b64in);
  if (!bytes || bytes.length < 100) return "";

  // Đã là JPEG thô
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return `data:image/jpeg;base64,${bytesToB64(bytes)}`;
  }
  // PNG
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return `data:image/png;base64,${bytesToB64(bytes)}`;
  }

  const jpeg = extractEmbeddedJpeg(bytes);
  if (jpeg) return `data:image/jpeg;base64,${bytesToB64(jpeg)}`;

  return "";
}

const PORTRAIT_KEYS_PRIORITY = [
  "ChipFace",
  "chipFace",
  "FaceImage",
  "faceImage",
  "FaceData",
  "faceData",
  "ImgData",
  "imgData",
  "PortraitBase64",
  "portraitBase64",
  "AnhChanDung",
  "Photo",
  "photo",
  "Dg2File",
  "dg2File",
  "Dg2",
  "dg2",
  "DG2",
];

function pickPortraitFromRecord(rec: AnyRecord | null): string {
  if (!rec) return "";
  for (const key of PORTRAIT_KEYS_PRIORITY) {
    const found = Object.keys(rec).find((k) => k.toLowerCase() === key.toLowerCase());
    const v = found ? rec[found] : undefined;
    if (v == null) continue;
    const url = toPortraitDataUrl(v);
    if (url) return url;
  }
  return "";
}

function pickDeepPortrait(raw: unknown, depth = 0): string {
  if (depth > 8) return "";
  const rec = asRecord(raw);
  if (!rec) return "";
  // Bỏ qua gói chỉ có frame OCR camera
  if (typeof rec.FrameData === "string" && !rec.ChipFace && !rec.FaceImage && !rec.Dg2) {
    const keys = Object.keys(rec);
    if (keys.every((k) => /frame|event|reader|message|serial/i.test(k))) {
      return "";
    }
  }
  const direct = pickPortraitFromRecord(rec);
  if (direct) return direct;
  for (const [k, value] of Object.entries(rec)) {
    if (/framedata|sod|dscert|readerserial/i.test(k)) continue;
    if (Array.isArray(value)) {
      // Mảng byte ảnh
      const asImg = toPortraitDataUrl(value);
      if (asImg) return asImg;
      for (const item of value) {
        const hit = pickDeepPortrait(item, depth + 1);
        if (hit) return hit;
      }
      continue;
    }
    if (value && typeof value === "object") {
      const hit = pickDeepPortrait(value, depth + 1);
      if (hit) return hit;
    }
  }
  return "";
}

/**
 * Chuẩn hóa JSON từ HN212Plugin / ComQ về schema nội bộ.
 */
export function normalizeHn212Payload(raw: unknown): Hn212CitizenScan | null {
  const obj = unwrapPayload(raw);
  if (!obj) return null;

  const treeHit = extractIdFromTree(raw);

  let cccd = (
    pickString(obj, [
      "_extractedCccd",
      "cccd",
      "CCCD",
      "IdNumber",
      "idNumber",
      "CitizenPid",
      "citizenPid",
      "PersonalId",
      "personalId",
      "SoDinhDanh",
      "soDinhDanh",
      "IdentityNumber",
      "DocumentNumber",
      "documentNumber",
      "PID",
      "pid",
    ]) || treeHit.cccd
  );
  cccd = normalizeCccd(cccd);

  let fullName =
    pickString(obj, [
      "_extractedName",
      "fullName",
      "FullName",
      "HoTen",
      "hoTen",
      "PersonName",
      "personName",
      "CitizenName",
      "citizenName",
    ]) || treeHit.fullName;

  // Fallback Name (tránh HANEL-…)
  if (!fullName) {
    const n = pickString(obj, ["Name", "name"]);
    if (n && !/^HANEL/i.test(n)) fullName = n;
  }

  // Dg1 trên object hiện tại
  const dg1 = pickString(obj, ["Dg1", "dg1", "DG1", "MRZ", "mrz"]);
  if (dg1) {
    const mrz = parseDg1Mrz(dg1);
    if (!cccd && mrz.cccd) cccd = mrz.cccd;
    if (!fullName && mrz.fullName) fullName = mrz.fullName;
  }

  const dobRaw = pickString(obj, [
    "dateOfBirth",
    "DateOfBirth",
    "Dob",
    "DOB",
    "NgaySinh",
    "ngaySinh",
    "BirthDate",
    "birthDate",
  ]);
  const dateOfBirth = parseVnDate(dobRaw);

  if (!cccd && !fullName) return null;

  const gender = parseGender(
    pickString(obj, ["gender", "Gender", "Sex", "sex", "GioiTinh", "gioiTinh"]),
  );

  const address = pickString(obj, [
    "address",
    "Address",
    "DiaChi",
    "diaChi",
    "PermanentAddress",
    "permanentAddress",
    "ResidencePlace",
    "residencePlace",
    "ThuongTru",
    "thuongTru",
    "ResidenceAddress",
  ]);

  const originPlace = pickString(obj, [
    "originPlace",
    "OriginPlace",
    "QueQuan",
    "queQuan",
    "Hometown",
    "hometown",
    "PlaceOfOrigin",
  ]);

  const nationality = pickString(obj, [
    "nationality",
    "Nationality",
    "QuocTich",
    "quocTich",
  ]);

  const ethnicity = pickString(obj, [
    "ethnicity",
    "Ethnicity",
    "DanToc",
    "danToc",
    "Race",
    "race",
    "Nation",
    "nation",
  ]);

  const religion = pickString(obj, [
    "religion",
    "Religion",
    "TonGiao",
    "tonGiao",
  ]);

  const oldIdNumber = pickString(obj, [
    "oldIdNumber",
    "OldIdNumber",
    "OldIdCode",
    "oldIdCode",
    "CMND",
    "cmnd",
    "OldPersonalId",
    "PreviousNumber",
    "previousNumber",
    "SoCMND",
  ]);

  // Nếu chưa có CCCD 12 số nhưng có CMND 9 số → dùng để tìm/điền tạm
  if (!cccd && oldIdNumber && looksLikeVnId(oldIdNumber)) {
    cccd = normalizeCccd(oldIdNumber);
  }

  const fatherName =
    pickString(obj, [
      "fatherName",
      "FatherName",
      "HoTenCha",
      "hoTenCha",
      "Father",
      "father",
    ]) || pickDeepString(raw, ["FatherName", "fatherName", "HoTenCha"]);

  const motherName =
    pickString(obj, [
      "motherName",
      "MotherName",
      "HoTenMe",
      "hoTenMe",
      "Mother",
      "mother",
    ]) || pickDeepString(raw, ["MotherName", "motherName", "HoTenMe"]);

  const identificationFeatures =
    pickString(obj, [
      "identificationFeatures",
      "Character",
      "character",
      "DacDiemNhanDang",
      "IdentifyingCharacteristics",
      "PersonalIdentification",
    ]) || pickDeepString(raw, ["Character", "character"]);

  const issueDate = parseVnDate(
    pickString(obj, [
      "issueDate",
      "IssueDate",
      "NgayCap",
      "ngayCap",
      "DateOfIssue",
    ]),
  );

  const expiryDate = parseVnDate(
    pickString(obj, [
      "expiryDate",
      "ExpiryDate",
      "ExpiredDate",
      "NgayHetHan",
      "ngayHetHan",
      "DateOfExpiry",
      "ValidUntil",
    ]),
  );

  const portraitBase64 =
    pickPortraitFromRecord(obj) || pickDeepPortrait(raw) || "";

  return {
    cccd,
    fullName,
    dateOfBirth,
    gender,
    address: address || undefined,
    originPlace: originPlace || undefined,
    nationality: nationality || undefined,
    ethnicity: ethnicity || undefined,
    religion: religion || undefined,
    oldIdNumber: oldIdNumber || undefined,
    issueDate: issueDate || undefined,
    expiryDate: expiryDate || undefined,
    fatherName: fatherName || undefined,
    motherName: motherName || undefined,
    identificationFeatures:
      typeof identificationFeatures === "string" &&
      identificationFeatures.length < 500 &&
      !identificationFeatures.startsWith("{")
        ? identificationFeatures
        : undefined,
    // Luôn là data URL đầy đủ nếu có ảnh hiển thị được
    portraitBase64: portraitBase64 || undefined,
    raw,
  };
}

/** Payload giả lập để test UI khi không có máy. */
export function demoHn212Scan(): Hn212CitizenScan {
  return {
    cccd: "079098012345",
    fullName: "NGUYỄN VĂN DEMO",
    dateOfBirth: "2002-04-24",
    gender: "male",
    address: "Xã Cờ Đỏ, Thành phố Cần Thơ",
    originPlace: "Thành phố Cần Thơ",
    nationality: "Việt Nam",
    ethnicity: "Kinh",
    religion: "Không",
    oldIdNumber: "301234567",
    issueDate: "2021-08-15",
    expiryDate: "2031-08-15",
    fatherName: "NGUYỄN VĂN CHA",
    motherName: "TRẦN THỊ MẸ",
    identificationFeatures: "Nốt ruồi dưới mắt phải",
    portraitBase64:
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=",
  };
}
