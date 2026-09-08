export type Hn212ReaderStatus =
  | "disconnected"
  | "connecting"
  | "ready"
  | "reading"
  | "error";

export type Hn212CitizenScan = {
  cccd: string;
  fullName: string;
  dateOfBirth: string;
  gender?: "male" | "female";
  address?: string;
  originPlace?: string;
  nationality?: string;
  ethnicity?: string;
  religion?: string;
  oldIdNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  fatherName?: string;
  motherName?: string;
  /** Đặc điểm nhận dạng (Character từ chip) */
  identificationFeatures?: string;
  portraitBase64?: string;
  raw?: unknown;
};

export type Hn212ReadResult =
  | { ok: true; data: Hn212CitizenScan }
  | { ok: false; error: string; code?: string };
