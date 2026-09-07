import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/data";
import {
  findEducationByCitizenId,
  insertEducationRecord,
  updateEducationRecord,
} from "@/lib/citizen-profile-db";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const citizenId = searchParams.get("citizenId") || undefined;

  if (citizenId) {
    const fromDb = await findEducationByCitizenId(citizenId);
    if (fromDb) {
      return NextResponse.json({
        data: fromDb.slice(0, limit),
        total: fromDb.length,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(fromDb.length / limit)),
        meta: { source: "mysql" },
      });
    }
  }

  const result = db.educationRecords.findAll({ page, limit, citizenId });
  return NextResponse.json({ ...result, meta: { source: "memory" } });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const citizenId = String(body.citizenId || "").trim();
    const institution = String(body.institution || "").trim();
    const level = String(body.level || "").trim();
    if (!citizenId || !institution || !level) {
      return NextResponse.json(
        { error: "Thiếu công dân, trường hoặc trình độ" },
        { status: 400 },
      );
    }

    const graduationYear =
      body.graduationYear != null && body.graduationYear !== ""
        ? Number(body.graduationYear)
        : undefined;
    const gpa =
      body.gpa != null && body.gpa !== "" ? Number(body.gpa) : undefined;

    const fromDb = await insertEducationRecord({
      citizenId,
      institution,
      level,
      major: body.major ? String(body.major) : undefined,
      graduationYear: Number.isFinite(graduationYear) ? graduationYear : undefined,
      gpa: Number.isFinite(gpa) ? gpa : undefined,
    });
    if (fromDb) {
      return NextResponse.json(fromDb, { status: 201 });
    }

    const newRecord = db.educationRecords.create({
      citizenId,
      institution,
      level,
      major: body.major ? String(body.major) : undefined,
      graduationYear: Number.isFinite(graduationYear) ? graduationYear : undefined,
      status: body.status || "completed",
      certificateNo: body.certificateNo,
      note:
        gpa != null && Number.isFinite(gpa)
          ? `GPA: ${Number(gpa.toFixed(2))}`
          : body.note,
    });
    return NextResponse.json(newRecord, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id || id.startsWith("cert-") || id.startsWith("syn-")) {
      return NextResponse.json(
        { error: "Không cập nhật được bản ghi này" },
        { status: 400 },
      );
    }

    const institution =
      body.institution !== undefined ? String(body.institution) : undefined;
    const level = body.level !== undefined ? String(body.level) : undefined;
    const major = body.major !== undefined ? String(body.major) : undefined;

    if (
      institution === undefined &&
      level === undefined &&
      major === undefined
    ) {
      return NextResponse.json({ error: "Không có dữ liệu cập nhật" }, { status: 400 });
    }
    if (institution !== undefined && !institution.trim()) {
      return NextResponse.json(
        { error: "Tên trường không được để trống" },
        { status: 400 },
      );
    }

    const updated = await updateEducationRecord(id, {
      institution,
      level,
      major,
    });
    if (!updated) {
      return NextResponse.json(
        { error: "Không cập nhật được học vấn" },
        { status: 404 },
      );
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
