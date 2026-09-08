import {
  generateGeminiJsonFromAudio,
  generateGeminiText,
  isGeminiConfigured,
} from "@/lib/gemini";

/** Từ số tiếng Việt (đọc từng chữ số CCCD) → digit */
const DIGIT_WORDS: Record<string, string> = {
  khong: "0",
  không: "0",
  linh: "0",
  lẻ: "0",
  le: "0",
  zero: "0",
  mot: "1",
  một: "1",
  mốt: "1",
  hai: "2",
  ba: "3",
  bon: "4",
  bốn: "4",
  tư: "4",
  tu: "4",
  nam: "5",
  năm: "5",
  lăm: "5",
  nhăm: "5",
  lam: "5",
  sau: "6",
  sáu: "6",
  bay: "7",
  bảy: "7",
  bẩy: "7",
  tam: "8",
  tám: "8",
  chin: "9",
  chín: "9",
};

function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function normalizeToken(raw: string): string {
  return stripDiacritics(raw.trim().toLowerCase()).replace(/[^a-z0-9]/g, "");
}

/** Lấy chuỗi số liên tiếp 9–12 chữ số trong văn bản */
export function extractDigitRuns(text: string): string[] {
  const runs = text.replace(/\s+/g, " ").match(/\d[\d\s.\-]{7,}\d/g) || [];
  return runs
    .map((r) => r.replace(/\D/g, ""))
    .filter((d) => d.length >= 9 && d.length <= 12);
}

/**
 * Đọc từng chữ số bằng từ tiếng Việt:
 * "không bảy chín không chín tám..." → "079098..."
 */
export function spokenDigitsToCccd(text: string): string | null {
  const tokens = text
    .toLowerCase()
    .replace(/[.,;:!?()[\]"']/g, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);

  const digits: string[] = [];
  for (const t of tokens) {
    if (/^\d$/.test(t)) {
      digits.push(t);
      continue;
    }
    // "079" gộp trong một token
    if (/^\d{2,12}$/.test(t)) {
      digits.push(...t.split(""));
      continue;
    }
    const mapped = DIGIT_WORDS[t] ?? DIGIT_WORDS[stripDiacritics(t)];
    if (mapped) digits.push(mapped);
  }

  if (digits.length < 9) return null;
  // Ưu tiên đúng 12 số (CCCD mới); nếu nhiều hơn lấy 12 số đầu hợp lệ
  const joined = digits.join("");
  if (joined.length === 12) return joined;
  if (joined.length > 12) {
    // thử cửa sổ 12
    for (let i = 0; i <= joined.length - 12; i++) {
      const slice = joined.slice(i, i + 12);
      if (/^\d{12}$/.test(slice)) return slice;
    }
    return joined.slice(0, 12);
  }
  // 9 số CMND cũ
  if (joined.length >= 9) return joined.slice(0, 12);
  return null;
}

function pickBestCccd(candidates: string[]): string | null {
  if (!candidates.length) return null;
  const twelve = candidates.find((c) => c.length === 12);
  if (twelve) return twelve;
  const nine = candidates.find((c) => c.length === 9);
  return nine || candidates[0];
}

/** Rule-based: số viết liền hoặc đọc từng chữ số */
export function extractCccdFromTextLocal(text: string): string | null {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const fromRuns = extractDigitRuns(raw);
  const fromSpoken = spokenDigitsToCccd(raw);
  const candidates = [
    ...fromRuns,
    ...(fromSpoken ? [fromSpoken] : []),
  ].filter((c) => c.length === 9 || c.length === 12);

  return pickBestCccd(candidates);
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Gemini NER — trích CCCD từ câu nói tiếng Việt tự nhiên */
export async function extractCccdWithGemini(
  transcript: string,
): Promise<{ cccd: string | null; raw?: string }> {
  if (!isGeminiConfigured()) {
    return { cccd: null };
  }

  const prompt = `Bạn là bộ trích xuất CCCD/CMND từ lời nói tiếng Việt (NLP).

Văn bản người dùng đọc (có thể đọc từng chữ số bằng chữ: không, một, hai... hoặc đọc số liền):
"""
${transcript}
"""

Nhiệm vụ: tìm SỐ CĂN CƯỚC CÔNG DÂN (12 chữ số) hoặc CMND (9 chữ số).
- Bỏ khoảng trắng, dấu chấm, gạch.
- Nếu đọc bằng chữ số tiếng Việt, chuyển thành chữ số Ả Rập.
- Chỉ trả JSON thuần, không markdown:
{"cccd":"079098012345"} hoặc {"cccd":null} nếu không tìm thấy.`;

  const raw = await generateGeminiText(prompt, {
    systemInstruction:
      "Trả đúng JSON một dòng. Không giải thích. cccd chỉ gồm chữ số hoặc null.",
  });
  const obj = extractJsonObject(raw);
  const cccd =
    typeof obj?.cccd === "string" ? obj.cccd.replace(/\D/g, "") : "";
  if (cccd.length === 9 || cccd.length === 12) {
    return { cccd, raw };
  }
  return { cccd: null, raw };
}

/**
 * Trích CCCD: rule trước, Gemini bổ sung nếu cần.
 */
export async function extractCccdFromNaturalLanguage(
  transcript: string,
): Promise<{
  cccd: string | null;
  method: "rule" | "gemini" | "none";
}> {
  const local = extractCccdFromTextLocal(transcript);
  if (local && (local.length === 9 || local.length === 12)) {
    return { cccd: local, method: "rule" };
  }

  if (isGeminiConfigured()) {
    try {
      const gem = await extractCccdWithGemini(transcript);
      if (gem.cccd) return { cccd: gem.cccd, method: "gemini" };
    } catch (e) {
      console.error("extractCccdWithGemini:", e);
    }
  }

  return { cccd: local, method: local ? "rule" : "none" };
}

/**
 * Nghe file ghi âm → transcript tiếng Việt + CCCD (Gemini multimodal).
 */
export async function transcribeAudioAndExtractCccd(args: {
  audioBase64: string;
  mimeType?: string;
}): Promise<{
  transcript: string;
  cccd: string | null;
  method: "audio_gemini" | "none";
}> {
  if (!isGeminiConfigured()) {
    throw new Error(
      "Chưa cấu hình GEMINI_API_KEY — không nhận dạng được file ghi âm.",
    );
  }

  const prompt = `Đây là file ghi âm người Việt đọc số Căn cước công dân (CCCD) hoặc CMND.

Hãy:
1) Chép lại toàn bộ lời nói thành chữ (tiếng Việt), kể cả khi họ đọc từng chữ số bằng chữ (không, một, hai…).
2) Trích số CCCD 12 chữ số (hoặc CMND 9 chữ số) thành chữ số Ả Rập.

Trả ĐÚNG một JSON, không markdown:
{"transcript":"...","cccd":"079098012345"}
Nếu không nghe rõ số: {"transcript":"...","cccd":null}`;

  const raw = await generateGeminiJsonFromAudio({
    audioBase64: args.audioBase64,
    mimeType: args.mimeType,
    prompt,
    systemInstruction:
      "Bạn là hệ thống ASR + NER CCCD tiếng Việt. Chỉ trả JSON hợp lệ.",
  });

  const obj = extractJsonObject(raw);
  const transcript =
    typeof obj?.transcript === "string" ? obj.transcript.trim() : "";
  let cccd =
    typeof obj?.cccd === "string" ? obj.cccd.replace(/\D/g, "") : "";

  if (!(cccd.length === 9 || cccd.length === 12) && transcript) {
    const local = extractCccdFromTextLocal(transcript);
    if (local) cccd = local;
  }

  if (!(cccd.length === 9 || cccd.length === 12)) {
    cccd = "";
  }

  return {
    transcript: transcript || "(không nhận được lời nói rõ)",
    cccd: cccd || null,
    method: cccd ? "audio_gemini" : "none",
  };
}
