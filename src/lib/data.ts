// In-memory data store for YMSA Management System
// In production, replace with a real database
import provincesData from '@/data/provinces.json';

export type HierarchyLevel = 'bo' | 'tinh' | 'huyen' | 'xa' | 'donvi';

export interface HierarchyUnit {
  code: string;
  name: string;
  level: HierarchyLevel;
  parentCode?: string; // code of the parent unit
}

export interface User {
  id: string;
  username: string;
  password: string; // plaintext for demo; use bcrypt in production
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'user';
  department: string;
  hierarchyLevel: HierarchyLevel;
  unitCode: string; // e.g. 'bo', 'tinh-hn', 'huyen-hk', 'xa-hb'
  status: 'active' | 'inactive';
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MilitaryDocument {
  id: string;
  code: string;
  title: string;
  content: string;
  type: 'incoming' | 'outgoing';
  fromUnit: string; // unitCode
  toUnits: string[]; // list of unitCodes that can see this doc
  date: string;
  status: 'pending' | 'processed' | 'sent';
  urgent: boolean;
  createdBy: string; // userId
  createdAt: string;
}

export interface Quota {
  id: string;
  year: number;
  fromLevel: HierarchyLevel;
  fromUnit: string;
  toLevel: HierarchyLevel;
  toUnit: string;
  toUnitName: string;
  amount: number;
  filled: number;
  note: string;
  createdAt: string;
}

export interface Citizen {
  id: string;
  fullName: string;
  cccd: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  nationality?: string;
  ethnicity?: string;
  religion?: string;
  originPlace?: string;
  address: string;
  /** DB: unit_code — đơn vị hành chính quản lý hồ sơ */
  unitCode?: string;
  phone: string;
  educationLevel: string;
  job: string;
  healthStatus?: string;
  identificationFeatures?: string;
  issueDate?: string;
  expiryDate?: string;
  fatherName?: string;
  motherName?: string;
  oldIdNumber?: string;
  militaryStatus:
    | 'chuakham'
    | 'dangkham'
    | 'trungtuyen'
    | 'truottuyen'
    | 'tamhoan'
    | 'miengoi'
    | 'nhapngu';
  /** DB: military_status_reason */
  militaryStatusReason?: string;
  /** Khóa chỉnh sửa trạng thái NVQS trực tiếp sau khi đã lưu — DB: military_status_locked */
  militaryStatusLocked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  headName: string;
  memberCount: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export type HealthExamPhase =
  | 'Sơ tuyển cấp xã'
  | 'Khám tuyển cấp huyện'
  | 'Khám tuyển cấp tỉnh';

/** Vòng 2 — khám chi tiết tại TTYT huyện / tỉnh */
export interface HealthExamDetail {
  facility?: string;
  chestCircumference?: number;
  visionLeft?: string;
  visionRight?: string;
  dental?: string;
  ent?: string;
  neurology?: string;
  pulse?: string;
  internalMedicine?: string;
  dermatology?: string;
  surgery?: string;
  labTests?: string;
}

export function isDetailedHealthPhase(phase: HealthExamPhase): boolean {
  return phase === 'Khám tuyển cấp huyện' || phase === 'Khám tuyển cấp tỉnh';
}

/** Diễn giải phân loại sức khỏe NVQS */
export function getHealthConclusionMeaning(
  conclusion: string,
  phase?: HealthExamPhase,
): string {
  const isScreening = phase === 'Sơ tuyển cấp xã';

  if (isScreening) {
    if (['Loại 1', 'Loại 2', 'Loại 3'].includes(conclusion)) {
      return 'Đạt sơ tuyển — chuyển khám chi tiết cấp huyện / tỉnh';
    }
    if (conclusion === 'Loại 4') return 'Tạm miễn — chưa đủ điều kiện khám tuyển';
    if (conclusion === 'Loại 5') return 'Miễn gọi nhập ngũ';
    return 'Không đủ sức khỏe — thuộc diện miễn NVQS';
  }

  switch (conclusion) {
    case 'Loại 1':
      return 'Đậu — đủ tiêu chuẩn sức khỏe nhập ngũ';
    case 'Loại 2':
      return 'Đậu — đủ tiêu chuẩn, hạn chế một số vị trí';
    case 'Loại 3':
      return 'Đậu — đủ tiêu chuẩn, hạn chế vị trí chiến đấu';
    case 'Loại 4':
      return 'Tạm miễn gọi nhập ngũ';
    case 'Loại 5':
      return 'Miễn gọi nhập ngũ';
    default:
      return 'Không đủ sức khỏe nhập ngũ';
  }
}

export interface HealthRecord {
  id: string;
  citizenId: string;
  year: number;
  phase: HealthExamPhase;
  height: number;
  weight: number;
  bloodPressure: string;
  vision: string;
  conclusion: 'Loại 1' | 'Loại 2' | 'Loại 3' | 'Loại 4' | 'Loại 5' | 'Loại 6';
  doctor: string;
  note?: string;
  detail?: HealthExamDetail;
  createdAt: string;
  updatedAt: string;
}

export type EducationLevelType =
  | '9/12'
  | '12/12'
  | 'Cao đẳng'
  | 'Đại học'
  | 'Thạc sĩ'
  | 'Tiến sĩ';

export interface EducationRecord {
  id: string;
  citizenId: string;
  level: EducationLevelType | string;
  institution: string;
  major?: string;
  startYear?: number;
  graduationYear?: number;
  status: 'completed' | 'studying' | 'dropped';
  certificateNo?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export type ResidenceType = 'Quê quán' | 'Thường trú' | 'Tạm trú' | 'Chuyển đi';

export interface ResidenceRecord {
  id: string;
  citizenId: string;
  type: ResidenceType;
  address: string;
  startYear?: number;
  endYear?: number;
  status: 'current' | 'past' | 'pending';
  decisionNo?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentCampaign {
  id: string;
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  status: 'planning' | 'ongoing' | 'completed';
  targetQuota: number;
  registeredCount: number;
  passedCount: number;
  createdAt: string;
  updatedAt: string;
}

// ── Hierarchy Unit Reference ──────────────────────────────────────────────
export const hierarchyUnits: HierarchyUnit[] = [
  { code: 'bo', name: 'Bộ Quốc phòng', level: 'bo' },
];

/**
 * Phân cấp hành chính mới (API v2): Bộ → Tỉnh/TP → Xã/Phường (không còn huyện/quận).
 * Nguồn: https://provinces.open-api.vn/api/v2/
 */
provincesData.forEach((p: any) => {
  const tinhCode = String(p.code);
  hierarchyUnits.push({
    code: tinhCode,
    name: p.name,
    level: 'tinh',
    parentCode: 'bo',
  });
  const wards = p.wards || [];
  wards.forEach((w: any) => {
    hierarchyUnits.push({
      code: `${tinhCode}-${w.code}`,
      name: w.name,
      level: 'xa',
      parentCode: tinhCode,
    });
  });
});

export function getChildUnits(parentCode: string): HierarchyUnit[] {
  return hierarchyUnits.filter((u) => u.parentCode === parentCode);
}

/** Mã PIN chỉnh sửa trạng thái NVQS — cấp phát theo đơn vị (tỉnh / huyện / xã)
 *  DB: hierarchy_units.edit_pin */
export const unitEditPins: Record<string, string> = {
  '92': '123456',
  '92-31201': '654321',
};

export function hierarchyNeedsEditPin(level: HierarchyLevel | string): boolean {
  return level === 'tinh' || level === 'huyen' || level === 'xa';
}

export function verifyUnitEditPin(unitCode: string, pin: string): boolean {
  const expected = unitEditPins[unitCode];
  if (!expected) return false;
  return expected === pin.trim();
}

// ── Seed data ──────────────────────────────────────────────────────────────
const citizens: Citizen[] = [
  {
    id: 'c1',
    fullName: 'Nguyễn Văn A',
    cccd: '001099012345',
    dateOfBirth: '2005-10-15',
    gender: 'male',
    nationality: 'Việt Nam',
    ethnicity: 'Kinh',
    religion: 'Không',
    originPlace: 'Châu Hưng, Thạnh Trị, Sóc Trăng',
    address: 'Phường 1, Quận 1, TP HCM',
    unitCode: '79-25747',
    identificationFeatures: 'Nốt ruồi cách 1cm dưới sau đuôi mắt phải',
    issueDate: '2022-09-15',
    expiryDate: '2027-10-15',
    fatherName: 'Nguyễn Văn B',
    motherName: 'Trần Thị C',
    oldIdNumber: '366350671',
    phone: '0901112233',
    educationLevel: '12/12',
    job: 'Sinh viên',
    healthStatus: 'Loại 1',
    militaryStatus: 'chuakham',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'c2',
    fullName: 'Trần Bình B',
    cccd: '001099123456',
    dateOfBirth: '2004-05-20',
    gender: 'male',
    nationality: 'Việt Nam',
    ethnicity: 'Kinh',
    religion: 'Phật giáo',
    originPlace: 'Hà Nội',
    address: 'Phường 2, Quận 3, TP HCM',
    unitCode: '79-25750',
    phone: '0902223344',
    educationLevel: 'Đại học',
    job: 'Nhân viên IT',
    healthStatus: 'Loại 3',
    militaryStatus: 'tamhoan',
    militaryStatusReason: 'Đang theo học đại học chính quy',
    militaryStatusLocked: true,
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'c3',
    fullName: 'Lê Hoàng C',
    cccd: '001098234567',
    dateOfBirth: '2006-12-05',
    gender: 'male',
    nationality: 'Việt Nam',
    ethnicity: 'Khmer',
    religion: 'Không',
    originPlace: 'Sóc Trăng',
    address: 'Phường 5, Quận 5, TP HCM',
    unitCode: '79-25747',
    phone: '0903334455',
    educationLevel: '9/12',
    job: 'Thợ điện',
    healthStatus: 'Loại 2',
    militaryStatus: 'trungtuyen',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-01T00:00:00Z',
  },
  {
    id: 'c4',
    fullName: 'Phạm Khắc D',
    cccd: '001097345678',
    dateOfBirth: '2003-08-30',
    gender: 'male',
    address: 'Phường 10, Quận Phú Nhuận, TP HCM',
    unitCode: '79-25750',
    phone: '0904445566',
    educationLevel: 'Cao đẳng',
    job: 'Kế toán',
    healthStatus: 'Loại 4',
    militaryStatus: 'miengoi',
    createdAt: '2024-04-01T00:00:00Z',
    updatedAt: '2024-04-01T00:00:00Z',
  },
  {
    id: 'c5',
    fullName: 'Hoàng Nhật E',
    cccd: '001096456789',
    dateOfBirth: '2002-02-14',
    gender: 'male',
    address: 'Phường 12, Quận Tân Bình, TP HCM',
    unitCode: '92-31201',
    phone: '0905556677',
    educationLevel: 'Thạc sĩ',
    job: 'Giảng viên',
    healthStatus: 'Loại 1',
    militaryStatus: 'nhapngu',
    createdAt: '2024-05-01T00:00:00Z',
    updatedAt: '2024-05-01T00:00:00Z',
  },
];

const users: User[] = [
  // Bộ QP
  {
    id: '1',
    username: 'admin_bo',
    password: '123',
    name: 'Quản trị Bộ Tham Mưu',
    email: 'admin.bo@ymsa.edu.vn',
    phone: '0900000001',
    role: 'admin',
    department: 'Bộ Quốc phòng',
    hierarchyLevel: 'bo',
    unitCode: 'bo',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  // TP Cần Thơ (code 92) — sau sáp nhập hành chính 2025
  {
    id: '2',
    username: 'admin_cantho',
    password: '123',
    name: 'CHQS Thành phố Cần Thơ',
    email: 'admin.cantho@ymsa.edu.vn',
    phone: '0900000002',
    role: 'user',
    department: 'Ban CHQS Thành phố Cần Thơ',
    hierarchyLevel: 'tinh',
    unitCode: '92',
    status: 'active',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
  },
  // Phường Hưng Phú (92-31201)
  {
    id: '3',
    username: 'admin_hungphu',
    password: '123',
    name: 'CHQS Phường Hưng Phú',
    email: 'admin.hungphu@ymsa.edu.vn',
    phone: '0900000003',
    role: 'user',
    department: 'Ban CHQS Phường Hưng Phú',
    hierarchyLevel: 'xa',
    unitCode: '92-31201',
    status: 'active',
    createdAt: '2024-04-01T00:00:00Z',
    updatedAt: '2024-04-01T00:00:00Z',
  },
];

// ── Document Store ─────────────────────────────────────────────────────────
const militaryDocuments: MilitaryDocument[] = [
  {
    id: 'd1',
    code: 'CV-2026/001',
    title: 'V/v Giao chỉ tiêu tuyển quân năm 2026',
    content: 'Căn cứ kế hoạch tuyển quân năm 2026, Bộ Quốc phòng giao chỉ tiêu như sau...',
    type: 'outgoing',
    fromUnit: 'bo',
    toUnits: ['tinh-hn', 'tinh-hcm', 'tinh-dn'],
    date: '2026-01-10',
    status: 'sent',
    urgent: true,
    createdBy: '1',
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'd2',
    code: 'CV-2026/012',
    title: 'V/v Tổ chức khám sức khỏe nghĩa vụ quân sự 2026',
    content: 'Yêu cầu các đơn vị tổ chức khám sức khỏe đúng tiến độ...',
    type: 'outgoing',
    fromUnit: 'tinh-hn',
    toUnits: ['huyen-hk', 'huyen-dd'],
    date: '2026-01-20',
    status: 'sent',
    urgent: true,
    createdBy: '2',
    createdAt: '2026-01-20T09:00:00Z',
  },
  {
    id: 'd3',
    code: 'BC-2026/045',
    title: 'Báo cáo tình hình biến động dân số quý I/2026',
    content: 'Kính gửi Ban CHQS Tỉnh, dưới đây là báo cáo biến động...',
    type: 'incoming',
    fromUnit: 'huyen-hk',
    toUnits: ['tinh-hn'],
    date: '2026-02-15',
    status: 'pending',
    urgent: false,
    createdBy: '4',
    createdAt: '2026-02-15T10:00:00Z',
  },
  {
    id: 'd4',
    code: 'CV-2026/008',
    title: 'V/v Cập nhật danh sách thanh niên đủ điều kiện',
    content: 'Yêu cầu xã cập nhật danh sách thanh niên trong độ tuổi...',
    type: 'outgoing',
    fromUnit: 'huyen-bc',
    toUnits: ['xa-bh', 'xa-lh'],
    date: '2026-02-20',
    status: 'sent',
    urgent: false,
    createdBy: '5',
    createdAt: '2026-02-20T14:00:00Z',
  },
];

// ── Quota Store ────────────────────────────────────────────────────────────
const quotas: Quota[] = [
  // Bộ → Tỉnh
  { id: 'q1', year: 2026, fromLevel: 'bo', fromUnit: 'bo', toLevel: 'tinh', toUnit: 'tinh-hn', toUnitName: 'Tỉnh Hà Nội', amount: 500, filled: 320, note: 'Chỉ tiêu theo nghị quyết số 01/2026', createdAt: '2026-01-05T00:00:00Z' },
  { id: 'q2', year: 2026, fromLevel: 'bo', fromUnit: 'bo', toLevel: 'tinh', toUnit: 'tinh-hcm', toUnitName: 'Tỉnh TP. HCM', amount: 800, filled: 560, note: 'Chỉ tiêu theo nghị quyết số 01/2026', createdAt: '2026-01-05T00:00:00Z' },
  { id: 'q3', year: 2026, fromLevel: 'bo', fromUnit: 'bo', toLevel: 'tinh', toUnit: 'tinh-dn', toUnitName: 'Tỉnh Đà Nẵng', amount: 200, filled: 150, note: 'Chỉ tiêu theo nghị quyết số 01/2026', createdAt: '2026-01-05T00:00:00Z' },
  // Tỉnh HN → Huyện
  { id: 'q4', year: 2026, fromLevel: 'tinh', fromUnit: 'tinh-hn', toLevel: 'huyen', toUnit: 'huyen-hk', toUnitName: 'Huyện Hoàn Kiếm', amount: 120, filled: 85, note: '', createdAt: '2026-01-12T00:00:00Z' },
  { id: 'q5', year: 2026, fromLevel: 'tinh', fromUnit: 'tinh-hn', toLevel: 'huyen', toUnit: 'huyen-dd', toUnitName: 'Huyện Đống Đa', amount: 150, filled: 100, note: '', createdAt: '2026-01-12T00:00:00Z' },
  // Huyện HK → Xã
  { id: 'q6', year: 2026, fromLevel: 'huyen', fromUnit: 'huyen-hk', toLevel: 'xa', toUnit: 'xa-hb', toUnitName: 'Xã Hàng Bông', amount: 35, filled: 28, note: '', createdAt: '2026-01-18T00:00:00Z' },
  { id: 'q7', year: 2026, fromLevel: 'huyen', fromUnit: 'huyen-hk', toLevel: 'xa', toUnit: 'xa-hd', toUnitName: 'Xã Hàng Đào', amount: 40, filled: 30, note: '', createdAt: '2026-01-18T00:00:00Z' },
  // Huyện BC → Xã
  { id: 'q8', year: 2026, fromLevel: 'huyen', fromUnit: 'huyen-bc', toLevel: 'xa', toUnit: 'xa-bh', toUnitName: 'Xã Bình Hưng', amount: 50, filled: 38, note: '', createdAt: '2026-01-20T00:00:00Z' },
];

// Helper to get all ancestor unit codes for a unit (including itself)
export function getUnitAncestors(unitCode: string): string[] {
  const result: string[] = [unitCode];
  const visited = new Set<string>([unitCode]);
  let current = hierarchyUnits.find((u) => u.code === unitCode);
  while (current?.parentCode) {
    if (visited.has(current.parentCode)) break;
    visited.add(current.parentCode);
    result.push(current.parentCode);
    current = hierarchyUnits.find((u) => u.code === current!.parentCode);
  }
  return result;
}

// Helper to get all descendant unit codes for a unit (including itself)
// Iterative BFS + visited set — tránh stack overflow khi dữ liệu có vòng lặp
export function getUnitDescendants(unitCode: string): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [unitCode];

  while (queue.length > 0) {
    const code = queue.shift()!;
    if (visited.has(code)) continue;
    visited.add(code);
    result.push(code);

    for (const child of hierarchyUnits) {
      if (child.parentCode === code && !visited.has(child.code)) {
        // Tránh self-parent / vòng lặp
        if (child.code === code) continue;
        queue.push(child.code);
      }
    }
  }

  return result;
}

const departments: Department[] = [
  {
    id: '1',
    name: 'Ban Giám Hiệu',
    code: 'BGH',
    description: 'Ban lãnh đạo trường',
    headName: 'Nguyễn Văn Admin',
    memberCount: 5,
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Khoa Cơ Khí',
    code: 'CK',
    description: 'Khoa Cơ Khí Động Lực',
    headName: 'Trần Văn Cơ',
    memberCount: 32,
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'Khoa CNTT',
    code: 'CNTT',
    description: 'Khoa Công Nghệ Thông Tin',
    headName: 'Lê Văn Tin',
    memberCount: 45,
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '4',
    name: 'Khoa Kinh Tế',
    code: 'KT',
    description: 'Khoa Kinh Tế - Quản Trị',
    headName: 'Phạm Thị Kinh',
    memberCount: 28,
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '5',
    name: 'Khoa Xây Dựng',
    code: 'XD',
    description: 'Khoa Kiến Trúc - Xây Dựng',
    headName: 'Nguyễn Văn Xây',
    memberCount: 38,
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '6',
    name: 'Phòng Đào Tạo',
    code: 'PDT',
    description: 'Phòng Quản Lý Đào Tạo',
    headName: 'Vũ Thị Đào',
    memberCount: 12,
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const healthRecords: HealthRecord[] = [
  {
    id: 'h1',
    citizenId: 'c1',
    year: 2026,
    phase: 'Sơ tuyển cấp xã',
    height: 175,
    weight: 68,
    bloodPressure: '120/80',
    vision: '10/10',
    conclusion: 'Loại 1',
    doctor: 'BS. Lê Trí',
    note: 'Đạt sơ tuyển Loại 1 — không phát hiện bệnh lý miễn NVQS, chuyển khám chi tiết.',
    detail: {
      facility: 'Trạm Y tế xã Phường 1',
    },
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'h2',
    citizenId: 'c1',
    year: 2026,
    phase: 'Khám tuyển cấp huyện',
    height: 175,
    weight: 68,
    bloodPressure: '118/79',
    vision: '10/10',
    conclusion: 'Loại 1',
    doctor: 'BS. Trần Y',
    note: 'Đạt Loại 1 — đậu điều kiện sức khỏe nghĩa vụ quân sự, đủ tiêu chuẩn nhập ngũ.',
    detail: {
      facility: 'Trung tâm Y tế huyện Thạnh Trị',
      chestCircumference: 92,
      visionLeft: '10/10',
      visionRight: '10/10',
      dental: 'Không sâu răng, đủ 32 răng, không sử dụng răng giả',
      ent: 'Thính lực bình thường (nói thầm 5m). Không viêm họng mạn tính, không chóng mặt',
      neurology: 'Không mồ hôi tay chân, không teo cơ / nhược cơ / tật máy cơ',
      pulse: '72 l/phút, đều',
      internalMedicine: 'Phổi trong sạch, tim nhịp đều, không phát hiện bất thường',
      dermatology: 'Da bình thường, không nấm da, không vảy nến / giang mai',
      surgery: 'Không trĩ, không bàn chân bẹt, không giãn tĩnh mạch thừng tinh',
      labTests: 'Công thức máu, sinh hóa cơ bản trong giới hạn bình thường',
    },
    createdAt: '2026-02-15T00:00:00Z',
    updatedAt: '2026-02-15T00:00:00Z',
  },
  {
    id: 'h5',
    citizenId: 'c1',
    year: 2025,
    phase: 'Sơ tuyển cấp xã',
    height: 174,
    weight: 67,
    bloodPressure: '122/82',
    vision: '10/10',
    conclusion: 'Loại 1',
    doctor: 'BS. Lê Trí',
    note: 'Khám sơ tuyển đợt 1 năm 2025.',
    detail: { facility: 'Trạm Y tế xã Phường 1' },
    createdAt: '2025-01-08T00:00:00Z',
    updatedAt: '2025-01-08T00:00:00Z',
  },
  {
    id: 'h6',
    citizenId: 'c1',
    year: 2025,
    phase: 'Khám tuyển cấp huyện',
    height: 174,
    weight: 67,
    bloodPressure: '120/80',
    vision: '9/10',
    conclusion: 'Loại 2',
    doctor: 'BS. Phạm Khoa',
    note: 'Thị lực mắt phải hơi giảm, phân loại 2.',
    detail: {
      facility: 'Trung tâm Y tế huyện Thạnh Trị',
      chestCircumference: 91,
      visionLeft: '10/10',
      visionRight: '9/10',
      dental: 'Sâu răng nhẹ 1 răng hàm, không mất răng',
      ent: 'Thính lực đạt. Viêm họng mạn tính nhẹ',
      neurology: 'Bình thường',
      pulse: '76 l/phút',
      internalMedicine: 'Tim phổi bình thường',
      dermatology: 'Không phát hiện bệnh da liễu',
      surgery: 'Không trĩ, không bàn chân bẹt',
      labTests: 'Xét nghiệm máu bình thường',
    },
    createdAt: '2025-02-20T00:00:00Z',
    updatedAt: '2025-02-20T00:00:00Z',
  },
  {
    id: 'h7',
    citizenId: 'c1',
    year: 2024,
    phase: 'Sơ tuyển cấp xã',
    height: 172,
    weight: 65,
    bloodPressure: '118/78',
    vision: '10/10',
    conclusion: 'Loại 1',
    doctor: 'BS. Lê Trí',
    note: 'Lần khám đầu tiên khi đủ tuổi sơ tuyển.',
    detail: { facility: 'Trạm Y tế xã Phường 1' },
    createdAt: '2024-01-12T00:00:00Z',
    updatedAt: '2024-01-12T00:00:00Z',
  },
  {
    id: 'h3',
    citizenId: 'c3',
    year: 2026,
    phase: 'Sơ tuyển cấp xã',
    height: 168,
    weight: 60,
    bloodPressure: '125/85',
    vision: '8/10',
    conclusion: 'Loại 2',
    doctor: 'BS. Lê Trí',
    createdAt: '2026-01-12T00:00:00Z',
    updatedAt: '2026-01-12T00:00:00Z',
  },
  {
    id: 'h4',
    citizenId: 'c4',
    year: 2026,
    phase: 'Sơ tuyển cấp xã',
    height: 160,
    weight: 50,
    bloodPressure: '110/70',
    vision: '5/10',
    conclusion: 'Loại 4',
    doctor: 'BS. Phạm Khoa',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
];

const educationRecords: EducationRecord[] = [
  {
    id: 'edu1',
    citizenId: 'c1',
    level: '9/12',
    institution: 'THCS Nguyễn Du',
    graduationYear: 2020,
    status: 'completed',
    certificateNo: 'THCS-2020-0142',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'edu2',
    citizenId: 'c1',
    level: '12/12',
    institution: 'THPT Chuyên Lê Quý Đôn',
    graduationYear: 2023,
    status: 'completed',
    certificateNo: 'THPT-2023-0891',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'edu3',
    citizenId: 'c1',
    level: 'Đại học',
    institution: 'Đại học Kinh tế TP.HCM',
    major: 'Công nghệ thông tin',
    startYear: 2023,
    status: 'studying',
    note: 'Đang học năm 2',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'edu4',
    citizenId: 'c2',
    level: '9/12',
    institution: 'THCS Trưng Vương',
    graduationYear: 2019,
    status: 'completed',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'edu5',
    citizenId: 'c2',
    level: '12/12',
    institution: 'THPT Nguyễn Thượng Hiền',
    graduationYear: 2022,
    status: 'completed',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'edu6',
    citizenId: 'c2',
    level: 'Đại học',
    institution: 'Đại học Bách Khoa TP.HCM',
    major: 'Khoa học máy tính',
    graduationYear: 2024,
    status: 'completed',
    certificateNo: 'DH-2024-5521',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'edu7',
    citizenId: 'c3',
    level: '9/12',
    institution: 'THCS Trần Văn Ơn',
    graduationYear: 2022,
    status: 'completed',
    note: 'Bỏ học sau THCS',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-01T00:00:00Z',
  },
  {
    id: 'edu8',
    citizenId: 'c4',
    level: '9/12',
    institution: 'THCS Lê Văn Tám',
    graduationYear: 2018,
    status: 'completed',
    createdAt: '2024-04-01T00:00:00Z',
    updatedAt: '2024-04-01T00:00:00Z',
  },
  {
    id: 'edu9',
    citizenId: 'c4',
    level: '12/12',
    institution: 'THPT Marie Curie',
    graduationYear: 2021,
    status: 'completed',
    createdAt: '2024-04-01T00:00:00Z',
    updatedAt: '2024-04-01T00:00:00Z',
  },
  {
    id: 'edu10',
    citizenId: 'c4',
    level: 'Cao đẳng',
    institution: 'Cao đẳng Kinh tế TP.HCM',
    major: 'Kế toán doanh nghiệp',
    graduationYear: 2023,
    status: 'completed',
    certificateNo: 'CD-2023-3310',
    createdAt: '2024-04-01T00:00:00Z',
    updatedAt: '2024-04-01T00:00:00Z',
  },
  {
    id: 'edu11',
    citizenId: 'c5',
    level: '9/12',
    institution: 'THCS Ngô Gia Tự',
    graduationYear: 2016,
    status: 'completed',
    createdAt: '2024-05-01T00:00:00Z',
    updatedAt: '2024-05-01T00:00:00Z',
  },
  {
    id: 'edu12',
    citizenId: 'c5',
    level: '12/12',
    institution: 'THPT Lê Hồng Phong',
    graduationYear: 2019,
    status: 'completed',
    createdAt: '2024-05-01T00:00:00Z',
    updatedAt: '2024-05-01T00:00:00Z',
  },
  {
    id: 'edu13',
    citizenId: 'c5',
    level: 'Đại học',
    institution: 'Đại học Quốc gia TP.HCM',
    major: 'Sư phạm Toán',
    graduationYear: 2023,
    status: 'completed',
    createdAt: '2024-05-01T00:00:00Z',
    updatedAt: '2024-05-01T00:00:00Z',
  },
  {
    id: 'edu14',
    citizenId: 'c5',
    level: 'Thạc sĩ',
    institution: 'Đại học Sư phạm TP.HCM',
    major: 'Giáo dục học',
    graduationYear: 2025,
    status: 'completed',
    certificateNo: 'THS-2025-0088',
    createdAt: '2024-05-01T00:00:00Z',
    updatedAt: '2024-05-01T00:00:00Z',
  },
];

const residenceRecords: ResidenceRecord[] = [
  {
    id: 'res1',
    citizenId: 'c1',
    type: 'Quê quán',
    address: 'Châu Hưng, Thạnh Trị, Sóc Trăng',
    status: 'past',
    note: 'Theo hộ khẩu gốc',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'res2',
    citizenId: 'c1',
    type: 'Thường trú',
    address: 'Ấp Châu Hưng, xã Châu Hưng, huyện Thạnh Trị, Sóc Trăng',
    startYear: 2005,
    endYear: 2022,
    status: 'past',
    decisionNo: 'QĐ-CT-2010-042',
    note: 'Chuyển đi do theo học đại học',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'res3',
    citizenId: 'c1',
    type: 'Thường trú',
    address: 'Phường 1, Quận 1, TP HCM',
    startYear: 2022,
    status: 'current',
    decisionNo: 'QĐ-CT-2022-1189',
    note: 'Địa chỉ đang quản lý trên hồ sơ',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'res4',
    citizenId: 'c2',
    type: 'Quê quán',
    address: 'Hà Nội',
    status: 'past',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'res5',
    citizenId: 'c2',
    type: 'Thường trú',
    address: 'Phường 2, Quận 3, TP HCM',
    startYear: 2020,
    status: 'current',
    decisionNo: 'QĐ-CT-2020-556',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'res6',
    citizenId: 'c3',
    type: 'Thường trú',
    address: 'Phường 5, Quận 5, TP HCM',
    startYear: 2018,
    status: 'current',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-01T00:00:00Z',
  },
];

const campaigns: RecruitmentCampaign[] = [
  {
    id: 'camp1',
    name: 'Đợt gọi nhập ngũ đợt 1 năm 2026',
    year: 2026,
    startDate: '2026-02-01',
    endDate: '2026-03-15',
    status: 'ongoing',
    targetQuota: 1500,
    registeredCount: 3200,
    passedCount: 450,
    createdAt: '2025-11-01T00:00:00Z',
    updatedAt: '2026-02-05T00:00:00Z',
  },
  {
    id: 'camp2',
    name: 'Đợt gọi nhập ngũ đợt 1 năm 2025',
    year: 2025,
    startDate: '2025-02-01',
    endDate: '2025-03-15',
    status: 'completed',
    targetQuota: 1450,
    registeredCount: 3100,
    passedCount: 1450,
    createdAt: '2024-11-01T00:00:00Z',
    updatedAt: '2025-03-20T00:00:00Z',
  },
];

// Helper to generate unique IDs
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// User CRUD
export const db = {
  users: {
    findAll: (query?: { search?: string; role?: string; status?: string; page?: number; limit?: number; unitCodes?: string[] }) => {
      let list = [...users];
      if (query?.search) {
        const s = query.search.toLowerCase();
        list = list.filter(
          (u) =>
            u.name.toLowerCase().includes(s) ||
            u.email.toLowerCase().includes(s) ||
            u.username.toLowerCase().includes(s) ||
            u.department.toLowerCase().includes(s)
        );
      }
      if (query?.role) list = list.filter((u) => u.role === query.role);
      if (query?.status) list = list.filter((u) => u.status === query.status);
      if (query?.unitCodes && query.unitCodes.length > 0) {
        list = list.filter((u) => query.unitCodes!.includes(u.unitCode));
      }
      const total = list.length;
      const page = query?.page || 1;
      const limit = query?.limit || 10;
      const start = (page - 1) * limit;
      return {
        data: list.slice(start, start + limit).map(({ password: _, ...u }) => u),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    },
    findById: (id: string) => {
      const u = users.find((u) => u.id === id);
      if (!u) return null;
      const { password: _, ...rest } = u;
      return rest;
    },
    findByUsername: (username: string) => users.find((u) => u.username === username) || null,
    create: (data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const user: User = { id: generateId(), ...data, createdAt: now, updatedAt: now };
      users.push(user);
      const { password: _, ...rest } = user;
      return rest;
    },
    update: (id: string, data: Partial<Omit<User, 'id' | 'createdAt'>>) => {
      const idx = users.findIndex((u) => u.id === id);
      if (idx === -1) return null;
      users[idx] = { ...users[idx], ...data, updatedAt: new Date().toISOString() };
      const { password: _, ...rest } = users[idx];
      return rest;
    },
    delete: (id: string) => {
      const idx = users.findIndex((u) => u.id === id);
      if (idx === -1) return false;
      users.splice(idx, 1);
      return true;
    },
  },
  departments: {
    findAll: (query?: { search?: string; status?: string; page?: number; limit?: number }) => {
      let list = [...departments];
      if (query?.search) {
        const s = query.search.toLowerCase();
        list = list.filter(
          (d) =>
            d.name.toLowerCase().includes(s) ||
            d.code.toLowerCase().includes(s) ||
            d.headName.toLowerCase().includes(s)
        );
      }
      if (query?.status) list = list.filter((d) => d.status === query.status);
      const total = list.length;
      const page = query?.page || 1;
      const limit = query?.limit || 10;
      const start = (page - 1) * limit;
      return {
        data: list.slice(start, start + limit),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    },
    findById: (id: string) => departments.find((d) => d.id === id) || null,
    create: (data: Omit<Department, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const dept: Department = { id: generateId(), ...data, createdAt: now, updatedAt: now };
      departments.push(dept);
      return dept;
    },
    update: (id: string, data: Partial<Omit<Department, 'id' | 'createdAt'>>) => {
      const idx = departments.findIndex((d) => d.id === id);
      if (idx === -1) return null;
      departments[idx] = { ...departments[idx], ...data, updatedAt: new Date().toISOString() };
      return departments[idx];
    },
    delete: (id: string) => {
      const idx = departments.findIndex((d) => d.id === id);
      if (idx === -1) return false;
      departments.splice(idx, 1);
      return true;
    },
  },
  citizens: {
    findAll: (query?: {
      search?: string;
      militaryStatus?: string;
      unitCodes?: string[];
      page?: number;
      limit?: number;
    }) => {
      let list = [...citizens];
      if (query?.search) {
        const s = query.search.toLowerCase();
        list = list.filter(
          (c) =>
            c.fullName.toLowerCase().includes(s) ||
            c.cccd.includes(s) ||
            c.address.toLowerCase().includes(s) ||
            c.phone.includes(s)
        );
      }
      if (query?.militaryStatus) list = list.filter((c) => c.militaryStatus === query.militaryStatus);
      if (query?.unitCodes && query.unitCodes.length > 0) {
        const allowed = new Set(query.unitCodes);
        list = list.filter((c) => c.unitCode && allowed.has(c.unitCode));
      }
      const total = list.length;
      const page = query?.page || 1;
      const limit = query?.limit || 10;
      const start = (page - 1) * limit;
      return {
        data: list.slice(start, start + limit),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    },
    findById: (id: string) => citizens.find((c) => c.id === id) || null,
    create: (data: Omit<Citizen, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const citizen: Citizen = { id: generateId(), ...data, createdAt: now, updatedAt: now };
      citizens.push(citizen);
      return citizen;
    },
    update: (id: string, data: Partial<Omit<Citizen, 'id' | 'createdAt'>>) => {
      const idx = citizens.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      citizens[idx] = { ...citizens[idx], ...data, updatedAt: new Date().toISOString() };
      return citizens[idx];
    },
    delete: (id: string) => {
      const idx = citizens.findIndex((c) => c.id === id);
      if (idx === -1) return false;
      citizens.splice(idx, 1);
      return true;
    },
  },
  healthRecords: {
    findAll: (query?: { citizenId?: string; year?: number; conclusion?: string; page?: number; limit?: number }) => {
      let list = [...healthRecords];
      
      if (query?.citizenId) list = list.filter((r) => r.citizenId === query.citizenId);
      if (query?.year) list = list.filter((r) => r.year === query.year);
      if (query?.conclusion) list = list.filter((r) => r.conclusion === query.conclusion);
      
      const total = list.length;
      const page = query?.page || 1;
      const limit = query?.limit || 10;
      const start = (page - 1) * limit;

      // Join with citizens data
      const data = list.slice(start, start + limit).map(record => {
        const citizen = citizens.find(c => c.id === record.citizenId);
        return {
          ...record,
          citizenName: citizen?.fullName || 'Không xác định',
          citizenCccd: citizen?.cccd || 'N/A',
        };
      });

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    },
    create: (data: Omit<HealthRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const record: HealthRecord = { id: generateId(), ...data, createdAt: now, updatedAt: now };
      healthRecords.push(record);
      return record;
    },
  },
  educationRecords: {
    findAll: (query?: { citizenId?: string; page?: number; limit?: number }) => {
      let list = [...educationRecords];

      if (query?.citizenId) list = list.filter((r) => r.citizenId === query.citizenId);

      const levelOrder = ['9/12', '12/12', 'Cao đẳng', 'Đại học', 'Thạc sĩ', 'Tiến sĩ'];
      list.sort((a, b) => {
        const ai = levelOrder.indexOf(a.level);
        const bi = levelOrder.indexOf(b.level);
        if (ai !== bi) return ai - bi;
        return (a.graduationYear || a.startYear || 0) - (b.graduationYear || b.startYear || 0);
      });

      const total = list.length;
      const page = query?.page || 1;
      const limit = query?.limit || 50;
      const start = (page - 1) * limit;

      return {
        data: list.slice(start, start + limit),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    },
    create: (data: Omit<EducationRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const record: EducationRecord = { id: generateId(), ...data, createdAt: now, updatedAt: now };
      educationRecords.push(record);
      return record;
    },
  },
  residenceRecords: {
    findAll: (query?: { citizenId?: string; page?: number; limit?: number }) => {
      let list = [...residenceRecords];

      if (query?.citizenId) list = list.filter((r) => r.citizenId === query.citizenId);

      const typeOrder: ResidenceType[] = ['Quê quán', 'Thường trú', 'Tạm trú', 'Chuyển đi'];
      const statusOrder = { current: 0, pending: 1, past: 2 };
      list.sort((a, b) => {
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        const typeDiff = typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
        if (typeDiff !== 0) return typeDiff;
        return (b.startYear || 0) - (a.startYear || 0);
      });

      const total = list.length;
      const page = query?.page || 1;
      const limit = query?.limit || 50;
      const start = (page - 1) * limit;

      return {
        data: list.slice(start, start + limit),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    },
    create: (data: Omit<ResidenceRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const record: ResidenceRecord = { id: generateId(), ...data, createdAt: now, updatedAt: now };
      residenceRecords.push(record);
      return record;
    },
  },
  campaigns: {
    findAll: (query?: { status?: string; year?: number; page?: number; limit?: number }) => {
      let list = [...campaigns];
      
      if (query?.status) list = list.filter((c) => c.status === query.status);
      if (query?.year) list = list.filter((c) => c.year === query.year);
      
      const total = list.length;
      const page = query?.page || 1;
      const limit = query?.limit || 10;
      const start = (page - 1) * limit;

      return {
        data: list.slice(start, start + limit),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    },
  },
  stats: {
    getOverview: () => ({
      totalUsers: users.filter((u) => u.role === 'user').length,
      totalAdmins: users.filter((u) => u.role === 'admin').length,
      totalDepartments: departments.length,
      activeUsers: users.filter((u) => u.status === 'active').length,
      inactiveUsers: users.filter((u) => u.status === 'inactive').length,
      activeDepartments: departments.filter((d) => d.status === 'active').length,
    }),
  },
  // ── Documents ────────────────────────────────────────────────────────────
  documents: {
    findForUnit: (unitCode: string, hierarchyLevel: string) => {
      // 'bo' level can see all documents
      if (hierarchyLevel === 'bo') return [...militaryDocuments];
      // Others see docs where their unitCode is in toUnits OR they are the sender
      return militaryDocuments.filter(
        (d) => d.toUnits.includes(unitCode) || d.fromUnit === unitCode
      );
    },
    findAll: () => [...militaryDocuments],
    create: (data: Omit<MilitaryDocument, 'id' | 'createdAt'>) => {
      const doc: MilitaryDocument = {
        id: generateId(),
        ...data,
        createdAt: new Date().toISOString(),
      };
      militaryDocuments.push(doc);
      return doc;
    },
    updateStatus: (id: string, status: MilitaryDocument['status']) => {
      const idx = militaryDocuments.findIndex((d) => d.id === id);
      if (idx === -1) return null;
      militaryDocuments[idx].status = status;
      return militaryDocuments[idx];
    },
  },
  // ── Quotas ───────────────────────────────────────────────────────────────
  quotas: {
    findForUnit: (unitCode: string, hierarchyLevel: string) => {
      if (hierarchyLevel === 'bo') return [...quotas];
      // See quotas assigned TO this unit (received) OR FROM this unit (issued)
      return quotas.filter(
        (q) => q.toUnit === unitCode || q.fromUnit === unitCode
      );
    },
    create: (data: Omit<Quota, 'id' | 'createdAt'>) => {
      const quota: Quota = {
        id: generateId(),
        ...data,
        createdAt: new Date().toISOString(),
      };
      quotas.push(quota);
      return quota;
    },
  },
};
