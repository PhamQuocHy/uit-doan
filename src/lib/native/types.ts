export type CitizenNFCData = {
  fullName: string;
  personalId: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  placeOfOrigin: string;
  placeOfResidence: string;
  expiryDate?: string;
  documentNumber?: string;
  mrz?: string;
};

export interface NFCResult {
  success: boolean;
  data?: CitizenNFCData;
  error?: string;
  errorCode?:
    | "NFC_NATIVE_ONLY"
    | "USER_CANCELLED"
    | "TAG_NOT_CCCD"
    | "NEED_CAN"
    | "NEED_MRZ"
    | "PACE_FAILED"
    | "BAC_FAILED"
    | "UNSUPPORTED_CURVE"
    | "READ_FAILED"
    | "PERMISSION"
    | string;
  chipDetected?: boolean;
}

export interface OcrFieldResult {
  fullName: string;
  personalId: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  placeOfOrigin: string;
  placeOfResidence: string;
  can?: string;
  mrz?: string;
  rawText?: string;
}

export interface OcrResult {
  success: boolean;
  data?: OcrFieldResult;
  error?: string;
}

export interface CaptureResult {
  success: boolean;
  imageBase64?: string;
  mimeType?: string;
  qualityScore?: number;
  error?: string;
}
