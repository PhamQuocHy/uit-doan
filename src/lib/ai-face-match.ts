import type { Citizen } from "@/lib/data";
import { generateGeminiJsonFromImages } from "@/lib/gemini";

const MATCH_THRESHOLD = 72;
const BATCH_SIZE = 6;

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
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
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
    { id: citizen.id, imageBase64: citizen.avatar },
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

  for (let i = 0; i < withAvatar.length; i += BATCH_SIZE) {
    const batch = withAvatar.slice(i, i + BATCH_SIZE);
    const verdict = await compareProbeToBatch(
      probeBase64,
      batch.map((c) => ({ id: c.id, imageBase64: c.avatar! })),
    );
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
    // Đã rất chắc → dừng sớm
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
