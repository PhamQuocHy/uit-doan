import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUnitDescendants } from "@/lib/data";
import { resolveViewUnit } from "@/lib/hierarchy";
import {
  findCitizenByCccdFromDb,
  findCitizensWithAvatarFromDb,
} from "@/lib/citizens-db";
import {
  searchFaceInGallery,
  verifyFaceAgainstCitizen,
  type FaceMatchHit,
} from "@/lib/ai-face-match";
import { isGeminiConfigured } from "@/lib/gemini";

function resolveUnitCodes(
  session: { unitCode: string; hierarchyLevel: string },
  requestedUnit?: string,
) {
  const scopeUnit = resolveViewUnit(
    session.unitCode,
    session.hierarchyLevel as "bo" | "tinh" | "xa",
    requestedUnit || session.unitCode,
  );
  return {
    scopeUnit,
    unitCodes: getUnitDescendants(scopeUnit.code),
  };
}

function normalizeImage(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const s = raw.trim();
  if (s.startsWith("data:image/")) return s;
  // raw base64 → jpeg data URL
  if (/^[A-Za-z0-9+/=\s]+$/.test(s.slice(0, 80))) {
    return `data:image/jpeg;base64,${s.replace(/\s+/g, "")}`;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json(
      {
        error:
          "Chưa cấu hình GEMINI_API_KEY. Thêm vào .env và khởi động lại server.",
      },
      { status: 503 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const probe =
      normalizeImage(body.imageBase64) ||
      normalizeImage(body.probeBase64) ||
      normalizeImage(body.portraitBase64);
    const cccd =
      typeof body.cccd === "string"
        ? body.cccd.replace(/\D/g, "")
        : "";
    const requestedUnit =
      typeof body.unitCode === "string" ? body.unitCode : undefined;

    if (!probe) {
      return NextResponse.json(
        { error: "Thiếu ảnh khuôn mặt (imageBase64)." },
        { status: 400 },
      );
    }

    let result: FaceMatchHit;

    if (cccd) {
      const citizen = await findCitizenByCccdFromDb(cccd);
      if (!citizen) {
        return NextResponse.json({
          matched: false,
          confidence: 0,
          mode: "verify_cccd",
          reason: `Không có hồ sơ với CCCD ${cccd}. Có thể thêm mới từ ảnh/chip vừa quét.`,
          citizen: null,
          prefillCccd: cccd,
        } satisfies FaceMatchHit & { prefillCccd: string });
      }
      result = await verifyFaceAgainstCitizen(probe, citizen);
    } else {
      const { unitCodes } = resolveUnitCodes(session, requestedUnit);
      const gallery = await findCitizensWithAvatarFromDb({
        unitCodes,
        limit: 40,
        ageScope: "active",
      });
      if (!gallery) {
        return NextResponse.json(
          { error: "Không kết nối được cơ sở dữ liệu." },
          { status: 503 },
        );
      }
      result = await searchFaceInGallery(probe, gallery);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("ai-face match error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không nhận dạng được khuôn mặt",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/admin/ai-face/match",
    configured: isGeminiConfigured(),
    modes: ["verify_cccd", "search_gallery"],
  });
}
