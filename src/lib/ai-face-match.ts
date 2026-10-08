import type { Citizen } from "@/lib/data";
import { generateGeminiJsonFromImages } from "@/lib/gemini";
import { readPrivateUpload } from "@/lib/private-uploads";

const MATCH_THRESHOLD = 72;
const BATCH_SIZE = 6;
const BATCH_CONCURRENCY = 3;
const GEMINI_TIMEOUT_MS = 30_000;

export type FaceMatchHit = {
  matched: boolean;
  confidence: number;
  mode: "verify_cccd" | "search_gallery";
  reason?: string;
  citizen: {
    id: string;
    fullName: string;
    cccd: string;
    dateOfBirth: string;
    address: string;
    militaryStatus: string;
    avatar?: string;
  } | null;
  /** Hồ sơ tìm theo CCCD nhưng chưa đủ ảnh để đối chiếu mặt */
  cccdFoundWithoutFace?: boolean;
  gallerySize?: number;
};

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    // Tolerate a short explanation before/after JSON without accepting
    // incomplete or unrelated objects.
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < trimmed.length; i += 1) {
      const char = trimmed[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{") {
        if (depth === 0) start = i;
        depth += 1;
      } else if (char === "}" && depth > 0) {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          try {
            return JSON.parse(trimmed.slice(start, i + 1));
          } catch {
            start = -1;
          }
        }
      }
    }
    throw new Error("AI không trả JSON hợp lệ.");
  }
}

function toPublicCitizen(c: Citizen): NonNullable<FaceMatchHit["citizen"]> {
  return {
    id: c.id,
    fullName: c.fullName,
    cccd: c.cccd,
    dateOfBirth: c.dateOfBirth,
    address: c.address,
    militaryStatus: c.militaryStatus,
    avatar: c.avatar,
  };
}

type BatchVerdict = {
  bestIndex: number | null;
  confidence: number;
  matched: boolean;
  reason?: string;
};

async function resolveAvatarImage(avatar: string): Promise<string> {
  const value = avatar.trim();
  if (value.startsWith("data:image/")) return value;

  const uploadPath = value.replace(/^\/+/, "");
  if (uploadPath.startsWith("uploads/")) {
    const data = await readPrivateUpload(uploadPath);
    const extension = uploadPath.split(".").pop()?.toLowerCase();
    const mime =
      extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : "image/jpeg";
    return `data:${mime};base64,${data.toString("base64")}`;
  }

  // Legacy records may still contain raw base64 rather than a private path.
  if (/^[A-Za-z0-9+/=\s]+$/.test(value)) {
    return `data:image/jpeg;base64,${value.replace(/\s+/g, "")}`;
  }

  throw new Error("Ảnh hồ sơ có định dạng không hỗ trợ.");
}

async function compareProbeToBatch(
  probeBase64: string,
  candidates: { id: string; imageBase64: string }[],
): Promise<BatchVerdict> {
  const images = [
    { base64: probeBase64, label: "PROBE (ảnh cần nhận dạng):" },
    ...candidates.map((c, i) => ({
      base64: c.imageBase64,
      label: `CANDIDATE_${i} (ảnh CCCD hồ sơ id=${c.id}):`,
    })),
  ];

  const raw = await generateGeminiJsonFromImages({
    systemInstruction:
      "Bạn là chuyên gia đối chiếu khuôn mặt phục vụ tra cứu hồ sơ công dân Việt Nam. Chỉ trả JSON, không markdown.",
    prompt: `Ảnh đầu là PROBE. Các ảnh sau là ảnh chân dung/CCCD đã lưu trong hồ sơ (CANDIDATE_0 …).
Hãy chọn ứng viên cùng một người với PROBE (nếu có).
Trả đúng JSON:
{"bestIndex": number|null, "confidence": 0-100, "matched": boolean, "reason": "ngắn bằng tiếng Việt"}
- bestIndex: chỉ số CANDIDATE_* khớp nhất, hoặc null nếu không ai khớp
- matched: true chỉ khi chắc chắn cùng người và confidence >= ${MATCH_THRESHOLD}
- Nếu ảnh mờ / không thấy mặt: matched=false, bestIndex=null`,
    images,
    timeoutMs: GEMINI_TIMEOUT_MS,
  });

  const parsed = extractJson(raw) as Partial<BatchVerdict>;
  const confidence = Math.max(
    0,
    Math.min(100, Number(parsed.confidence) || 0),
  );
  const bestIndex =
    typeof parsed.bestIndex === "number" &&
    Number.isFinite(parsed.bestIndex) &&
    parsed.bestIndex >= 0 &&
    parsed.bestIndex < candidates.length
      ? Math.floor(parsed.bestIndex)
      : null;
  const matched =
    Boolean(parsed.matched) &&
    confidence >= MATCH_THRESHOLD &&
    bestIndex != null;

  return {
    bestIndex: matched ? bestIndex : null,
    confidence,
    matched,
    reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
  };
}

/** 1:1 — đối chiếu ảnh probe với ảnh CCCD đã lưu */
export async function verifyFaceAgainstCitizen(
  probeBase64: string,
  citizen: Citizen,
): Promise<FaceMatchHit> {
  if (!citizen.avatar?.trim()) {
    return {
      matched: false,
      confidence: 0,
      mode: "verify_cccd",
      reason: "Hồ sơ chưa có ảnh CCCD để đối chiếu khuôn mặt.",
      citizen: toPublicCitizen(citizen),
      cccdFoundWithoutFace: true,
    };
  }

  const verdict = await compareProbeToBatch(probeBase64, [
    { id: citizen.id, imageBase64: await resolveAvatarImage(citizen.avatar) },
  ]);

  return {
    matched: verdict.matched,
    confidence: Math.round(verdict.confidence * 10) / 10,
    mode: "verify_cccd",
    reason: verdict.reason,
    citizen: toPublicCitizen(citizen),
  };
}

/** 1:N — tìm trong gallery ảnh CCCD */
export async function searchFaceInGallery(
  probeBase64: string,
  gallery: Citizen[],
): Promise<FaceMatchHit> {
  const withAvatar = gallery.filter((c) => c.avatar?.trim());
  if (!withAvatar.length) {
    return {
      matched: false,
      confidence: 0,
      mode: "search_gallery",
      reason:
        "Chưa có hồ sơ nào trong phạm vi có ảnh CCCD. Quét HN-212 khi thêm công dân để lưu ảnh chip.",
      citizen: null,
      gallerySize: 0,
    };
  }

  let best: {
    citizen: Citizen;
    confidence: number;
    reason?: string;
  } | null = null;

  const batches = [];
  for (let i = 0; i < withAvatar.length; i += BATCH_SIZE) {
    batches.push(withAvatar.slice(i, i + BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i += BATCH_CONCURRENCY) {
    const wave = batches.slice(i, i + BATCH_CONCURRENCY);
    const results = await Promise.allSettled(
      wave.map(async (batch) => ({
        batch,
        verdict: await compareProbeToBatch(
          probeBase64,
          await Promise.all(
            batch.map(async (c) => ({
              id: c.id,
              imageBase64: await resolveAvatarImage(c.avatar!),
            })),
          ),
        ),
      })),
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const { batch, verdict } = result.value;
      if (
        verdict.matched &&
        verdict.bestIndex != null &&
        (!best || verdict.confidence > best.confidence)
      ) {
        best = {
          citizen: batch[verdict.bestIndex]!,
          confidence: verdict.confidence,
          reason: verdict.reason,
        };
      }
    }

    // Do not spend more API calls after a highly confident match.
    if (best && best.confidence >= 92) break;
  }

  if (!best) {
    return {
      matched: false,
      confidence: 0,
      mode: "search_gallery",
      reason: "Không tìm thấy khuôn mặt khớp trong các ảnh CCCD đã lưu.",
      citizen: null,
      gallerySize: withAvatar.length,
    };
  }

  return {
    matched: true,
    confidence: Math.round(best.confidence * 10) / 10,
    mode: "search_gallery",
    reason: best.reason,
    citizen: toPublicCitizen(best.citizen),
    gallerySize: withAvatar.length,
  };
}
