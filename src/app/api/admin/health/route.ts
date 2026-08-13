import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, isDetailedHealthPhase } from "@/lib/data";
import {
  findCitizenByIdFromDb,
  updateCitizenInDb,
} from "@/lib/citizens-db";
import { pingDb } from "@/lib/db";
import {
  canEnterHealthRecords,
  detailedRecordForYear,
  getAvailableExamRounds,
  isScreeningPass,
  screeningRecordForYear,
  type HealthExamRound,
} from "@/lib/health-exam";

async function findCitizen(citizenId: string) {
  if (await pingDb()) {
    const fromDb = await findCitizenByIdFromDb(citizenId);
    if (fromDb) return fromDb;
  }
  return db.citizens.findById(citizenId);
}

async function syncCitizenAfterExam(
  citizenId: string,
  conclusion: string,
  phase: string,
) {
  const patch: Record<string, string> = { healthStatus: conclusion };

  if (isDetailedHealthPhase(phase as never)) {
    if (["Loại 1", "Loại 2", "Loại 3"].includes(conclusion)) {
      patch.militaryStatus = "trungtuyen";
    } else if (conclusion === "Loại 4") {
      patch.militaryStatus = "tamhoan";
    } else if (["Loại 5", "Loại 6"].includes(conclusion)) {
      patch.militaryStatus = "miengoi";
    }
  } else if (!isScreeningPass(conclusion)) {
    if (conclusion === "Loại 4") patch.militaryStatus = "tamhoan";
    else if (["Loại 5", "Loại 6"].includes(conclusion)) {
      patch.militaryStatus = "miengoi";
    } else {
      patch.militaryStatus = "truottuyen";
    }
  } else {
    patch.militaryStatus = "dangkham";
  }

  if (await pingDb()) {
    await updateCitizenInDb(citizenId, patch);
  }
  db.citizens.update(citizenId, patch);
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const citizenId = searchParams.get("citizenId") || undefined;
  const year = searchParams.get("year")
    ? parseInt(searchParams.get("year")!, 10)
    : undefined;
  const conclusion = searchParams.get("conclusion") || undefined;

  const result = db.healthRecords.findAll({
    page,
    limit,
    citizenId,
    year,
    conclusion,
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canEnterHealthRecords(session.functionalRole, session.role)) {
    return NextResponse.json(
      { error: "Bạn không có quyền nhập kết quả khám sức khỏe." },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const {
      citizenId,
      year,
      phase,
      height,
      weight,
      bloodPressure,
      vision,
      conclusion,
      doctor,
      note,
      detail,
    } = body;

    if (!citizenId || !year || !phase || !conclusion || !doctor) {
      return NextResponse.json(
        { error: "Thiếu thông tin bắt buộc (công dân, năm, vòng khám, kết luận, bác sĩ)." },
        { status: 400 },
      );
    }

    const citizen = await findCitizen(citizenId);
    if (!citizen) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ công dân." }, { status: 404 });
    }

    const existing = db.healthRecords.findAll({ citizenId, limit: 100 }).data;
    const round: HealthExamRound =
      phase === "Sơ tuyển cấp xã" ? "screening" : "detailed";

    if (round === "screening" && screeningRecordForYear(existing, year)) {
      return NextResponse.json(
        { error: `Đã có kết quả Vòng 1 (sơ tuyển) năm ${year}.` },
        { status: 409 },
      );
    }

    if (round === "detailed") {
      const screening = screeningRecordForYear(existing, year);
      if (!screening) {
        return NextResponse.json(
          { error: "Chưa có kết quả Vòng 1. Cần hoàn thành sơ tuyển cấp xã trước." },
          { status: 400 },
        );
      }
      if (!isScreeningPass(screening.conclusion)) {
        return NextResponse.json(
          { error: "Công dân không đạt sơ tuyển — không được khám chi tiết." },
          { status: 400 },
        );
      }
      if (detailedRecordForYear(existing, year)) {
        return NextResponse.json(
          { error: `Đã có kết quả Vòng 2 (khám chi tiết) năm ${year}.` },
          { status: 409 },
        );
      }
    }

    const allowed = getAvailableExamRounds(existing, year);
    if (!allowed.includes(round)) {
      return NextResponse.json(
        { error: "Không thể nhập vòng khám này theo quy trình hiện tại." },
        { status: 400 },
      );
    }

    const newRecord = db.healthRecords.create({
      citizenId,
      year,
      phase,
      height,
      weight,
      bloodPressure: bloodPressure || "—",
      vision: vision || "—",
      conclusion,
      doctor,
      note,
      detail,
    });

    await syncCitizenAfterExam(citizenId, conclusion, phase);

    return NextResponse.json(newRecord, { status: 201 });
  } catch (error) {
    console.error("Health POST error:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
