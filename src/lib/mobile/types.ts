export const MOBILE_SESSION_STATUSES = [
  "WAITING",
  "CONNECTED",
  "SCANNING",
  "PROCESSING",
  "COMPLETED",
  "ERROR",
  "EXPIRED",
  "DISCONNECTED",
] as const;

export type MobileSessionStatus = (typeof MOBILE_SESSION_STATUSES)[number];

export type CitizenData = {
  fullName: string;
  personalId: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  placeOfOrigin: string;
  placeOfResidence: string;
};

export type FieldMismatch = {
  field: keyof CitizenData | string;
  nfc: string;
  ocr: string;
};

export type VerificationResult = {
  matched: boolean;
  mismatches: FieldMismatch[];
};

export type MobileSession = {
  sessionId: string;
  connectionCode: string;
  status: MobileSessionStatus;
  createdAt: string;
  expiresAt: string;
  connectedAt: string | null;
  lastError: string | null;
};

export type ScanResultPayload = {
  sessionId: string;
  scanId: string;
  nfc: Partial<CitizenData> & Record<string, unknown>;
  ocr: Partial<CitizenData> & Record<string, unknown>;
  verification: VerificationResult;
  device: { platform: string; [key: string]: unknown };
};
