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
  militaryStatus: 'chuakham' | 'dangkham' | 'trungtuyen' | 'tamhoan' | 'miengoi' | 'nhapngu';
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

export interface HealthRecord {
  id: string;
  citizenId: string;
  year: number;
  phase: 'Sơ tuyển cấp xã' | 'Khám tuyển cấp huyện';
  height: number;
  weight: number;
  bloodPressure: string;
  vision: string;
  conclusion: 'Loại 1' | 'Loại 2' | 'Loại 3' | 'Loại 4' | 'Loại 5' | 'Loại 6';
  doctor: string;
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

provincesData.forEach((p: any) => {
  hierarchyUnits.push({
    code: String(p.code),
    name: p.name,
    level: 'tinh',
    parentCode: 'bo'
  });
  if (p.districts) {
    p.districts.forEach((d: any) => {
      hierarchyUnits.push({
        code: String(d.code),
        name: d.name,
        level: 'huyen',
        parentCode: String(p.code)
      });
      if (d.wards) {
        d.wards.forEach((w: any) => {
          hierarchyUnits.push({
            code: String(w.code),
            name: w.name,
            level: 'xa',
            parentCode: String(d.code)
          });
        });
      }
    });
  }
});

export function getChildUnits(parentCode: string): HierarchyUnit[] {
  return hierarchyUnits.filter((u) => u.parentCode === parentCode);
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
    phone: '0902223344',
    educationLevel: 'Đại học',
    job: 'Nhân viên IT',
    healthStatus: 'Loại 3',
    militaryStatus: 'tamhoan',
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
  // Tỉnh Sóc Trăng (Code 94)
  {
    id: '2',
    username: 'admin_tientrang',
    password: '123',
    name: 'CHQS Tỉnh Sóc Trăng',
    email: 'admin.soctrang@ymsa.edu.vn',
    phone: '0900000002',
    role: 'user',
    department: 'Ban CHQS Tỉnh Sóc Trăng',
    hierarchyLevel: 'tinh',
    unitCode: '94',
    status: 'active',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
  },
  // Huyện Thạnh Trị (Code 950)
  {
    id: '3',
    username: 'admin_thanhtri',
    password: '123',
    name: 'CHQS Huyện Thạnh Trị',
    email: 'admin.thanhtri@ymsa.edu.vn',
    phone: '0900000003',
    role: 'user',
    department: 'Ban CHQS Huyện Thạnh Trị',
    hierarchyLevel: 'huyen',
    unitCode: '950',
    status: 'active',
    createdAt: '2024-03-01T00:00:00Z',
    updatedAt: '2024-03-01T00:00:00Z',
  },
  // Thị trấn Hưng Lợi (Code 31757)
  {
    id: '4',
    username: 'admin_hungloi',
    password: '123',
    name: 'CHQS Thị trấn Hưng Lợi',
    email: 'admin.hungloi@ymsa.edu.vn',
    phone: '0900000004',
    role: 'user',
    department: 'Ban CHQS Thị trấn Hưng Lợi',
    hierarchyLevel: 'xa',
    unitCode: '31757',
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
  let current = hierarchyUnits.find((u) => u.code === unitCode);
  while (current?.parentCode) {
    result.push(current.parentCode);
    current = hierarchyUnits.find((u) => u.code === current!.parentCode);
  }
  return result;
}

// Helper to get all descendant unit codes for a unit (including itself)
export function getUnitDescendants(unitCode: string): string[] {
  const result: string[] = [unitCode];
  const children = hierarchyUnits.filter((u) => u.parentCode === unitCode);
  for (const child of children) {
    result.push(...getUnitDescendants(child.code));
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
    createdAt: '2026-02-15T00:00:00Z',
    updatedAt: '2026-02-15T00:00:00Z',
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
    findAll: (query?: { search?: string; militaryStatus?: string; page?: number; limit?: number }) => {
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
