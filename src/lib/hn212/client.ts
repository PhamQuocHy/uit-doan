import { normalizeHn212Payload } from "./normalize";
import type { Hn212CitizenScan, Hn212ReadResult, Hn212ReaderStatus } from "./types";
import { asRec, eventNameOf, sanitizeHn212Raw } from "./utils";

export const HN212_WS_STORAGE_KEY = "hn212_ws_url";
/** ComQ ID Reader / HN212Plugin mặc định lắng nghe cổng 8000 */
export const DEFAULT_HN212_WS_URL = "ws://127.0.0.1:8000";

/** Chỉ gửi đúng 1 lệnh ReadCard (ComQ) — tránh spam lệnh làm nhiễu máy. */
const READ_CARD_CMD = {
  CommandName: "ReadCard",
  param1: "",
  param2: "",
  param3: "",
  param4: "",
} as const;

const STOP_FACE_CMD = {
  CommandName: "StopFaceCapture",
  param1: "",
  param2: "",
  param3: "",
  param4: "",
} as const;

const START_FACE_CMD = {
  CommandName: "StartFaceCapture",
  param1: "",
  param2: "",
  param3: "",
  param4: "",
} as const;

const STOP_MONITOR_CMD = {
  CommandName: "StopMonitor",
  param1: "",
  param2: "",
  param3: "",
  param4: "",
} as const;

const START_MONITOR_CMD = {
  CommandName: "StartMonitor",
  param1: "",
  param2: "",
  param3: "",
  param4: "",
} as const;

const CAPTURE_FACE_CMD = {
  CommandName: "CaptureFace",
  param1: "",
  param2: "",
  param3: "",
  param4: "",
} as const;

const GET_CAMERA_LIST_CMD = {
  CommandName: "GetCameraList",
  param1: "",
  param2: "",
  param3: "",
  param4: "",
} as const;

const RESET_CAMERA_HUB_CMD = {
  CommandName: "ResetCameraHUB",
  param1: "",
  param2: "",
  param3: "",
  param4: "",
} as const;

const PAUSE_CMD = {
  CommandName: "Pause",
  param1: "",
  param2: "",
  param3: "",
  param4: "",
} as const;

const RESUME_CMD = {
  CommandName: "Resume",
  param1: "",
  param2: "",
  param3: "",
  param4: "",
} as const;

type ComqCameraInfo = { Id: string; Name: string; Index?: number };

function parseCameraListParam(param1: unknown): ComqCameraInfo[] {
  if (typeof param1 !== "string" || !param1.trim()) return [];
  try {
    const parsed = JSON.parse(param1) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        const r = asRec(row);
        if (!r) return null;
        const Id = String(r.Id || "");
        const Name = String(r.Name || "");
        if (!Id && !Name) return null;
        return {
          Id,
          Name,
          Index: typeof r.Index === "number" ? r.Index : undefined,
        };
      })
      .filter((x): x is ComqCameraInfo => !!x);
  } catch {
    return [];
  }
}

/** Frame camera / OCR — bỏ qua khi đang chờ chip */
function isFaceCaptureFrame(raw: unknown): boolean {
  const rec = asRec(raw);
  if (!rec) return false;
  const ev = eventNameOf(raw);
  if (ev === "FACECAPTURE" || ev === "MONITOR" || ev === "VIDEO") {
    return (
      typeof rec.FrameData === "string" ||
      typeof rec.FaceData === "string" ||
      typeof rec.ImgData === "string"
    );
  }
  return typeof rec.FrameData === "string" && rec.FrameData.length > 100;
}

/** Nhanh cho live preview — không decode byte (tránh đứng hình) */
function fastLiveFrameDataUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (s.length < 80) return "";
  if (s.startsWith("data:image/")) return s;
  const b64 = s.replace(/\s+/g, "");
  if (b64.length < 80) return "";
  if (b64.startsWith("/9j/")) return `data:image/jpeg;base64,${b64}`;
  if (b64.startsWith("iVBOR")) return `data:image/png;base64,${b64}`;
  if (b64.startsWith("UklGR")) return `data:image/webp;base64,${b64}`;
  // ComQ thường gửi JPEG base64 thuần
  if (/^[A-Za-z0-9+/]+=*$/.test(b64.slice(0, 48))) {
    return `data:image/jpeg;base64,${b64}`;
  }
  return "";
}

function isStatusOnlyEvent(raw: unknown): boolean {
  const ev = eventNameOf(raw);
  return (
    ev === "READER" ||
    ev === "CARD" ||
    ev === "RESPONSE" ||
    ev === "FACECAPTURE"
  );
}

function summarizeEvent(raw: unknown): string {
  const rec = asRec(raw);
  if (!rec) return typeof raw === "string" ? raw.slice(0, 80) : "msg";
  const ev = eventNameOf(raw) || "?";
  if (isFaceCaptureFrame(raw)) return `${ev}(frame)`;
  const state = rec.NewState ? `:${rec.NewState}` : "";
  const msg =
    typeof rec.Message === "string" && rec.Message.trim()
      ? ` ${rec.Message.trim().slice(0, 40)}`
      : "";
  const keys = Object.keys(rec)
    .filter((k) => !["FrameData", "FaceData", "ImgData", "ChipFace"].includes(k))
    .slice(0, 8)
    .join(",");
  return `${ev}${state}${msg}${keys ? ` [${keys}]` : ""}`;
}

function looksLikeCardData(raw: unknown): boolean {
  if (isFaceCaptureFrame(raw)) return false;
  const data = normalizeHn212Payload(raw);
  if (data && (data.cccd || data.fullName)) return true;
  const rec = asRec(raw);
  if (!rec) return false;
  if (eventNameOf(raw) === "CARD_RESULT") return true;
  if (rec.IdCard || rec.PersonalInfo || rec.CardResultInfo || rec.CardFullData) {
    return true;
  }
  // Gói { id, data } từ ComQ
  const nested = asRec(rec.data) ?? asRec(rec.Data);
  if (
    nested &&
    (nested.IdCard ||
      nested.PersonalInfo ||
      nested.DocumentNumber ||
      nested.PersonName ||
      nested.FatherName ||
      nested.MotherName)
  ) {
    return true;
  }
  if (
    typeof rec.Message === "string" &&
    /read successfully/i.test(rec.Message)
  ) {
    return true;
  }
  return false;
}

export function getDefaultHn212WsUrl(): string {
  if (typeof window !== "undefined") {
    try {
      let stored = localStorage.getItem(HN212_WS_STORAGE_KEY)?.trim();
      // Migrate sai mặc định cũ :9000 → :8000
      if (stored === "ws://127.0.0.1:9000" || stored === "ws://localhost:9000") {
        stored = DEFAULT_HN212_WS_URL;
        localStorage.setItem(HN212_WS_STORAGE_KEY, stored);
      }
      if (stored) return stored;
    } catch {
      /* ignore */
    }
  }
  return (
    process.env.NEXT_PUBLIC_HN212_WS_URL?.trim() || DEFAULT_HN212_WS_URL
  );
}

export function saveHn212WsUrl(url: string) {
  try {
    localStorage.setItem(HN212_WS_STORAGE_KEY, url.trim());
  } catch {
    /* ignore */
  }
}

function parseMessageData(data: unknown): unknown {
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      if (/^\d{9,12}$/.test(trimmed)) {
        return { cccd: trimmed };
      }
      return { message: trimmed };
    }
  }
  if (data instanceof ArrayBuffer) {
    try {
      const text = new TextDecoder().decode(data);
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  return data;
}

export class Hn212Client {
  private ws: WebSocket | null = null;
  private status: Hn212ReaderStatus = "disconnected";
  private lastError: string | null = null;
  private statusHint: string | null = null;
  private eventLog: string[] = [];
  private lastCardRaw: unknown = null;
  private url: string;
  private connectedUrl: string | null = null;
  private statusListeners = new Set<
    (s: Hn212ReaderStatus, err: string | null, hint: string | null) => void
  >();
  private pendingResolvers: Array<{
    resolve: (r: Hn212ReadResult) => void;
    timer: ReturnType<typeof setTimeout>;
    cardSeen: boolean;
    retried: boolean;
  }> = [];
  /** Đang xem preview khuôn mặt qua ComQ (plugin giữ webcam) */
  private facePreviewActive = false;
  private lastFaceFrameDataUrl: string | null = null;
  private faceFrameListeners = new Set<(dataUrl: string) => void>();
  private faceFrameCount = 0;
  private lastFaceFrameAt = 0;
  private lastFaceEmitAt = 0;
  private faceHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private faceStreamMode: "face" | "monitor" | null = null;
  /** Đã Pause / nhả cam để trình duyệt mở webcam */
  private webcamYielded = false;
  private responseWaiters: Array<{
    name: string;
    resolve: (rec: Record<string, unknown>) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(url?: string) {
    this.url = url || getDefaultHn212WsUrl();
  }

  getWsUrl() {
    return this.url;
  }

  setWsUrl(url: string) {
    const next = url.trim() || DEFAULT_HN212_WS_URL;
    if (next !== this.url) {
      this.url = next;
      saveHn212WsUrl(this.url);
      if (this.ws) {
        try {
          this.ws.onopen = null;
          this.ws.onmessage = null;
          this.ws.onerror = null;
          this.ws.onclose = null;
          this.ws.close();
        } catch {
          /* ignore */
        }
        this.ws = null;
        this.connectedUrl = null;
        this.setStatus("disconnected");
      }
    } else {
      this.url = next;
      saveHn212WsUrl(this.url);
    }
  }

  getStatus() {
    return this.status;
  }

  getLastError() {
    return this.lastError;
  }

  getStatusHint() {
    return this.statusHint;
  }

  getEventLog() {
    return [...this.eventLog];
  }

  /** Payload chip gần nhất (đã cắt ảnh) — để debug map field */
  getLastCardRaw() {
    return this.lastCardRaw;
  }

  onStatus(
    listener: (
      s: Hn212ReaderStatus,
      err: string | null,
      hint: string | null,
    ) => void,
  ) {
    this.statusListeners.add(listener);
    listener(this.status, this.lastError, this.statusHint);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private setStatus(
    status: Hn212ReaderStatus,
    error: string | null = null,
    hint: string | null = null,
  ) {
    this.status = status;
    this.lastError = error;
    if (hint !== undefined) this.statusHint = hint;
    for (const l of this.statusListeners) {
      l(status, error, this.statusHint);
    }
  }

  private pushEvent(raw: unknown) {
    const line = `${new Date().toLocaleTimeString("vi-VN")} ${summarizeEvent(raw)}`;
    this.eventLog = [...this.eventLog.slice(-11), line];
    // Cập nhật UI log ngay cả khi không đổi status
    if (this.pendingResolvers.length) {
      for (const l of this.statusListeners) {
        l(this.status, this.lastError, this.statusHint);
      }
    }
  }

  private settle(result: Hn212ReadResult) {
    const pending = [...this.pendingResolvers];
    this.pendingResolvers = [];
    for (const p of pending) {
      clearTimeout(p.timer);
      p.resolve(result);
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.setStatus(
        "ready",
        result.ok ? null : result.error,
        result.ok ? "Đọc chip thành công" : null,
      );
    }
  }

  private sendJson(payload: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }

  private waitForResponse(
    responseName: string,
    timeoutMs = 2500,
  ): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      const entry = {
        name: responseName,
        resolve: (rec: Record<string, unknown>) => {
          clearTimeout(entry.timer);
          this.responseWaiters = this.responseWaiters.filter((w) => w !== entry);
          resolve(rec);
        },
        timer: setTimeout(() => {
          this.responseWaiters = this.responseWaiters.filter((w) => w !== entry);
          resolve(null);
        }, timeoutMs),
      };
      this.responseWaiters.push(entry);
    });
  }

  private handleIncoming(raw: unknown) {
    const rec = asRec(raw);
    const ev = eventNameOf(raw);
    const faceFrame = isFaceCaptureFrame(raw);

    if (ev === "RESPONSE" && rec) {
      const responseName = String(rec.ResponseName || "");
      if (responseName) {
        const matched = this.responseWaiters.filter((w) => w.name === responseName);
        for (const w of matched) w.resolve(rec);
      }
    }

    // Preview live: không spam eventLog bằng từng frame
    if (!(faceFrame && this.facePreviewActive)) {
      this.pushEvent(raw);
    }

    if (faceFrame) {
      if (this.facePreviewActive) {
        const frame =
          fastLiveFrameDataUrl(rec?.FrameData) ||
          fastLiveFrameDataUrl(rec?.FaceData) ||
          fastLiveFrameDataUrl(rec?.ImgData) ||
          fastLiveFrameDataUrl(rec?.FaceImage);
        if (frame) {
          this.lastFaceFrameDataUrl = frame;
          this.faceFrameCount += 1;
          this.lastFaceFrameAt = Date.now();
          // CaptureFace đã ~4fps — emit hầu hết frame
          const now = Date.now();
          if (now - this.lastFaceEmitAt >= 50 || this.faceFrameCount <= 2) {
            this.lastFaceEmitAt = now;
            for (const l of this.faceFrameListeners) l(frame);
          }
        }
      } else if (this.pendingResolvers.length) {
        this.setStatus(
          "reading",
          null,
          "Đang OCR / camera… giữ CCCD trong khe máy.",
        );
      }
      return;
    }

    if (ev === "CARD" && this.pendingResolvers.length) {
      const state = String(rec?.NewState || "");
      // ComQ: PRESENT / INSERTED — không dùng ADDED (đó là READER)
      if (/PRESENT|INSERTED|IN_DEVICE|CARD_IN/i.test(state)) {
        for (const p of this.pendingResolvers) p.cardSeen = true;
        this.setStatus("reading", null, "Đã nhận thẻ — đang đọc chip…");
        const head = this.pendingResolvers[0];
        if (head && !head.retried) {
          head.retried = true;
          this.sendJson(STOP_FACE_CMD);
          this.sendJson(READ_CARD_CMD);
        }
      } else if (/ABSENT|REMOVED|EMPTY|OUT/i.test(state)) {
        this.setStatus(
          "reading",
          null,
          "Thẻ đã rút — hãy cắm lại CCCD vào khe.",
        );
      } else if (state) {
        this.setStatus("reading", null, `Trạng thái thẻ: ${state}`);
      }
      return;
    }

    if (ev === "READER" && this.pendingResolvers.length) {
      return;
    }

    if (!looksLikeCardData(raw)) {
      const errMsg =
        (typeof rec?.error === "string" && rec.error) ||
        (typeof rec?.Error === "string" && rec.Error) ||
        (typeof rec?.Message === "string" &&
        /fail|error|lỗi|không đọc|timeout|time\s*out/i.test(rec.Message) &&
        !isStatusOnlyEvent(raw)
          ? rec.Message
          : null);
      if (errMsg && this.pendingResolvers.length) {
        this.settle({ ok: false, error: String(errMsg), code: "DEVICE_ERROR" });
      }
      return;
    }

    const data = normalizeHn212Payload(raw);
    if (!data || (!data.cccd && !data.fullName)) {
      if (this.pendingResolvers.length) {
        this.lastCardRaw = sanitizeHn212Raw(raw);
        const keys = rec ? Object.keys(rec).join(", ") : "(không có key)";
        this.setStatus(
          "reading",
          null,
          `Có phản hồi chip nhưng chưa map được CCCD/họ tên. Keys: ${keys}`,
        );
        if (
          ev === "CARD_RESULT" ||
          /read successfully/i.test(String(rec?.Message || ""))
        ) {
          this.settle({
            ok: false,
            error: `Plugin đã trả kết quả nhưng thiếu CCCD/họ tên. Keys: ${keys}`,
            code: "PARSE_FAILED",
          });
        }
      }
      return;
    }
    this.lastCardRaw = sanitizeHn212Raw(raw);
    // Có tên nhưng chưa có CCCD → vẫn trả về để form điền; search sẽ xử lý riêng
    this.settle({ ok: true, data });
  }

  async connect(url?: string): Promise<Hn212ReadResult | { ok: true }> {
    if (url) this.setWsUrl(url);
    if (
      this.ws?.readyState === WebSocket.OPEN &&
      this.connectedUrl === this.url
    ) {
      this.setStatus("ready");
      return { ok: true };
    }

    this.disconnect();
    this.setStatus("connecting");

    return new Promise((resolve) => {
      let settled = false;
      const finish = (r: Hn212ReadResult | { ok: true }) => {
        if (settled) return;
        settled = true;
        resolve(r);
      };

      try {
        const ws = new WebSocket(this.url);
        this.ws = ws;

        const connectTimer = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            try {
              ws.close();
            } catch {
              /* ignore */
            }
            this.setStatus(
              "error",
              "Không kết nối được ComQ ID Reader (HN212Plugin). Chạy plugin, cắm máy USB, dùng cổng ws://127.0.0.1:8000.",
            );
            finish({
              ok: false,
              error:
                "Chưa chạy ComQ ID Reader / HN212Plugin hoặc sai WebSocket (mặc định ws://127.0.0.1:8000).",
              code: "CONNECT_TIMEOUT",
            });
          }
        }, 5000);

        ws.onopen = () => {
          clearTimeout(connectTimer);
          this.connectedUrl = this.url;
          this.setStatus("ready", null, "Đã kết nối ComQ");
          finish({ ok: true });
        };

        ws.onmessage = async (event) => {
          let data: unknown = event.data;
          if (data instanceof Blob) {
            try {
              data = JSON.parse(await data.text());
            } catch {
              return;
            }
          } else {
            data = parseMessageData(data);
          }
          if (data != null) this.handleIncoming(data);
        };

        ws.onerror = () => {
          clearTimeout(connectTimer);
          this.setStatus(
            "error",
            "Lỗi WebSocket. Hãy mở ComQ ID Reader (HN212Plugin) — cổng mặc định 8000.",
          );
          finish({
            ok: false,
            error:
              "Chưa chạy ComQ ID Reader / HN212Plugin hoặc sai WebSocket (mặc định ws://127.0.0.1:8000).",
            code: "WS_ERROR",
          });
        };

        ws.onclose = () => {
          clearTimeout(connectTimer);
          if (this.pendingResolvers.length) {
            this.settle({
              ok: false,
              error: "Mất kết nối HN212Plugin khi đang đọc thẻ.",
              code: "WS_CLOSED",
            });
          }
          this.ws = null;
          this.connectedUrl = null;
          if (this.status !== "error") {
            this.setStatus("disconnected");
          }
        };
      } catch (err) {
        this.setStatus(
          "error",
          err instanceof Error ? err.message : "Không mở được WebSocket",
        );
        finish({
          ok: false,
          error:
            "Trình duyệt không mở được WebSocket. Kiểm tra URL (vd: ws://127.0.0.1:8000).",
          code: "WS_CREATE_FAILED",
        });
      }
    });
  }

  disconnect() {
    for (const p of this.pendingResolvers) {
      clearTimeout(p.timer);
      p.resolve({
        ok: false,
        error: "Đã hủy kết nối HN-212",
        code: "CANCELLED",
      });
    }
    this.pendingResolvers = [];
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.connectedUrl = null;
    this.setStatus("disconnected");
  }

  /**
   * StopFaceCapture → ReadCard (1 lần) → chờ CARD_RESULT.
   * Bỏ qua FACECAPTURE khi đang đọc chip. Nếu CARD PRESENT sau khi bấm quét → gửi lại ReadCard 1 lần.
   */
  async readCardOnce(timeoutMs = 90000): Promise<Hn212ReadResult> {
    const connected = await this.connect();
    if ("error" in connected && connected.ok === false) return connected;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return {
        ok: false,
        error: "ComQ ID Reader chưa sẵn sàng.",
        code: "NOT_READY",
      };
    }

    // Nếu đang nhả cam cho trình duyệt → Resume để đọc chip ổn định
    if (this.webcamYielded) {
      await this.restoreAfterBrowserWebcam();
    }

    this.eventLog = [];
    this.setStatus(
      "reading",
      null,
      "Cắm CCCD vào khe rồi giữ nguyên — đang gửi lệnh ReadCard…",
    );

    return new Promise((resolve) => {
      const entry = {
        resolve,
        cardSeen: false,
        retried: false,
        timer: setTimeout(() => {
          this.pendingResolvers = this.pendingResolvers.filter(
            (p) => p.resolve !== resolve,
          );
          const log = this.eventLog.slice(-6).join(" | ") || "(không có sự kiện)";
          this.setStatus("ready");
          resolve({
            ok: false,
            error: entry.cardSeen
              ? `Máy đã thấy thẻ nhưng không trả dữ liệu chip. Log: ${log}`
              : `Không nhận được dữ liệu chip trong ${Math.round(timeoutMs / 1000)}s. Cắm CCCD vào khe HN-212 (không chỉ đặt gần), mở ComQ, rồi quét lại. Log: ${log}`,
            code: "READ_TIMEOUT",
          });
        }, timeoutMs),
      };
      this.pendingResolvers.push(entry);

      this.sendJson(STOP_FACE_CMD);
      this.sendJson(READ_CARD_CMD);
    });
  }

  /**
   * Nhả webcam mà ComQ đang giữ (HN212 Camera = PC camera) để trình duyệt
   * getUserMedia được. Quét CCCD (ReadCard) không cần webcam.
   */
  async releaseFaceCapture(options?: {
    waitMs?: number;
  }): Promise<{ ok: boolean; detail: string; cameras?: string[] }> {
    const waitMs = options?.waitMs ?? 2200;
    try {
      const connected = await this.connect();
      if ("error" in connected && connected.ok === false) {
        return {
          ok: false,
          detail: connected.error || "Chưa kết nối được ComQ",
        };
      }
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return { ok: false, detail: "WebSocket ComQ chưa mở" };
      }

      this.facePreviewActive = false;
      this.clearFaceHeartbeat();

      // 1) Lấy danh sách cam ComQ đang nắm
      const listWait = this.waitForResponse("GetCameraList", 2500);
      this.sendJson(GET_CAMERA_LIST_CMD);
      const listRes = await listWait;
      const cameras = parseCameraListParam(listRes?.param1);
      const names = cameras.map((c) => c.Name || c.Id).filter(Boolean);

      // 2) Dừng face / monitor / từng camera
      for (let i = 0; i < 2; i++) {
        this.sendJson(STOP_MONITOR_CMD);
        this.sendJson(STOP_FACE_CMD);
        await new Promise((r) => setTimeout(r, 80));
      }

      for (const cam of cameras) {
        if (!cam.Id) continue;
        this.sendJson({
          CommandName: "ReqStopCamera",
          param1: cam.Id,
          param2: "2500",
          param3: "",
          param4: "",
        });
        await new Promise((r) => setTimeout(r, 120));
      }
      // Index fallback (một số bản chỉ nhận số)
      for (const cam of cameras) {
        if (cam.Index == null) continue;
        this.sendJson({
          CommandName: "ReqStopCamera",
          param1: String(cam.Index),
          param2: "2500",
          param3: "",
          param4: "",
        });
      }
      this.sendJson({
        CommandName: "ReqStopCamera",
        param1: "",
        param2: "2500",
        param3: "",
        param4: "",
      });

      // 3) Tắt OCR cam + reset hub + Pause pipeline camera
      this.sendJson({
        CommandName: "PowerOnOffCamera",
        param1: "false",
        param2: "false",
        param3: "",
        param4: "",
      });
      this.sendJson({
        CommandName: "PowerOnOffCamera",
        param1: "ocrCamera",
        param2: "false",
        param3: "",
        param4: "",
      });
      this.sendJson(RESET_CAMERA_HUB_CMD);
      this.sendJson(PAUSE_CMD);
      this.webcamYielded = true;

      await new Promise((r) => setTimeout(r, waitMs));

      return {
        ok: true,
        detail: names.length
          ? `Đã yêu cầu ComQ nhả: ${names.join(", ")}`
          : "Đã gửi ReqStopCamera + Pause để nhả webcam",
        cameras: names,
      };
    } catch (e) {
      return {
        ok: false,
        detail: e instanceof Error ? e.message : "Không nhả được camera ComQ",
      };
    }
  }

  /** Khôi phục ComQ sau khi trình duyệt xong webcam (trước khi quét CCCD). */
  async restoreAfterBrowserWebcam(): Promise<void> {
    if (!this.webcamYielded) {
      // Vẫn gửi Resume phòng trường hợp Pause trước đó
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.sendJson(RESUME_CMD);
        }
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        await this.connect();
      }
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendJson(RESUME_CMD);
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch {
      /* ignore */
    } finally {
      this.webcamYielded = false;
    }
  }

  private async ensureComqCameraReady(): Promise<string | null> {
    await this.restoreAfterBrowserWebcam();

    const listWait = this.waitForResponse("GetCameraList", 2500);
    this.sendJson(GET_CAMERA_LIST_CMD);
    const listRes = await listWait;
    const cameras = parseCameraListParam(listRes?.param1);
    const preferred =
      cameras.find((c) => /hn212|pc\s*camera|058f|3841/i.test(c.Name || c.Id)) ||
      cameras[0];

    if (preferred?.Id) {
      this.sendJson({
        CommandName: "ReqStartCamera",
        param1: preferred.Id,
        param2: "8",
        param3: "",
        param4: "",
      });
      await new Promise((r) => setTimeout(r, 400));
    } else if (preferred?.Index != null) {
      this.sendJson({
        CommandName: "ReqStartCamera",
        param1: String(preferred.Index),
        param2: "8",
        param3: "",
        param4: "",
      });
      await new Promise((r) => setTimeout(r, 400));
    }

    // StartFaceCapture giúp plugin mở pipeline trước khi CaptureFace
    this.sendJson(START_FACE_CMD);
    await new Promise((r) => setTimeout(r, 350));
    return preferred?.Name || preferred?.Id || null;
  }

  /**
   * Chụp 1 khung qua plugin — đường chính khi HN212Plugin đang giữ webcam.
   */
  async grabFaceStill(timeoutMs = 8000): Promise<{
    ok: boolean;
    frame?: string;
    error?: string;
  }> {
    const connected = await this.connect();
    if ("error" in connected && connected.ok === false) {
      return { ok: false, error: connected.error };
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return { ok: false, error: "ComQ chưa sẵn sàng. Chạy HN212Plugin rồi thử lại." };
    }

    const camName = await this.ensureComqCameraReady();

    this.lastFaceFrameDataUrl = null;
    const prevPreview = this.facePreviewActive;
    this.facePreviewActive = true;
    this.sendJson(CAPTURE_FACE_CMD);

    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (this.lastFaceFrameDataUrl) {
        const frame = this.lastFaceFrameDataUrl;
        this.facePreviewActive = prevPreview;
        this.sendJson(STOP_FACE_CMD);
        return { ok: true, frame };
      }
      await new Promise((r) => setTimeout(r, 100));
      if ((Date.now() - started) % 700 < 120) {
        this.sendJson(CAPTURE_FACE_CMD);
      }
    }

    this.facePreviewActive = prevPreview;
    this.sendJson(STOP_FACE_CMD);
    return {
      ok: false,
      error: camName
        ? `Không nhận ảnh từ ${camName}. Đưa mặt trước webcam PC rồi bấm lại.`
        : "Không nhận ảnh từ ComQ. Đưa mặt trước webcam PC rồi bấm lại.",
    };
  }

  onFaceFrame(listener: (dataUrl: string) => void) {
    this.faceFrameListeners.add(listener);
    if (this.lastFaceFrameDataUrl) listener(this.lastFaceFrameDataUrl);
    return () => {
      this.faceFrameListeners.delete(listener);
    };
  }

  getLastFaceFrame() {
    return this.lastFaceFrameDataUrl;
  }

  isFacePreviewActive() {
    return this.facePreviewActive;
  }

  /**
   * Preview live qua ComQ: poll CaptureFace (~4 ảnh/giây).
   * Giữ frame cũ trên UI đến khi có frame mới → không nháy đen.
   */
  async startFacePreview(timeoutMs = 10000): Promise<{
    ok: boolean;
    error?: string;
    frame?: string;
  }> {
    const connected = await this.connect();
    if ("error" in connected && connected.ok === false) {
      return { ok: false, error: connected.error };
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return { ok: false, error: "ComQ ID Reader chưa sẵn sàng." };
    }

    await this.ensureComqCameraReady();

    this.clearFaceHeartbeat();
    this.facePreviewActive = true;
    this.faceFrameCount = 0;
    this.lastFaceFrameAt = 0;
    this.lastFaceEmitAt = 0;
    // Không xóa frame cũ ngay — tránh màn hình đen khi mở lại
    this.faceStreamMode = "face";
    this.setStatus(
      "ready",
      null,
      "Đang mở live view qua HN212Plugin…",
    );

    const poll = () => {
      if (!this.facePreviewActive) return;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      if (this.pendingResolvers.length > 0) return;
      this.sendJson(CAPTURE_FACE_CMD);
    };
    poll();
    this.faceHeartbeatTimer = setInterval(poll, 240);

    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (this.lastFaceFrameDataUrl) {
        this.setStatus(
          "ready",
          null,
          "Live view — canh mặt vào khung rồi Chụp & nhận dạng",
        );
        return { ok: true, frame: this.lastFaceFrameDataUrl };
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    this.setStatus(
      "ready",
      null,
      "Đã mở preview — đưa mặt trước webcam PC…",
    );
    return {
      ok: true,
      error: "Chưa nhận frame. Đưa mặt trước webcam PC.",
    };
  }

  /** Chụp ngay 1 khung (khi bấm Chụp) */
  requestFaceSnapshot() {
    if (!this.facePreviewActive) return;
    this.sendJson(CAPTURE_FACE_CMD);
  }

  stopFacePreview() {
    this.facePreviewActive = false;
    this.faceStreamMode = null;
    this.clearFaceHeartbeat();
    // Không StartFaceCapture nên chỉ cần dừng poll; gửi Stop để chắc
    this.sendJson(STOP_FACE_CMD);
  }

  private clearFaceHeartbeat() {
    if (this.faceHeartbeatTimer) {
      clearInterval(this.faceHeartbeatTimer);
      this.faceHeartbeatTimer = null;
    }
  }
}

let sharedClient: Hn212Client | null = null;

export function getHn212Client(): Hn212Client {
  if (typeof window === "undefined") {
    return new Hn212Client();
  }
  if (!sharedClient) sharedClient = new Hn212Client();
  return sharedClient;
}

export type { Hn212CitizenScan, Hn212ReadResult, Hn212ReaderStatus };
