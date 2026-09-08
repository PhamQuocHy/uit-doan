import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, type ResidenceRecord } from "@/lib/data";
import {
  findResidenceByCitizenId,
  insertResidenceRecord,
} from "@/lib/citizen-profile-db";

const RESIDENCE_TYPES = new Set([
  "Quê quán",
  "Thường trú",
  "Tạm trú",
  "Chuyển đi",
]);
const RESIDENCE_STATUSES = new Set(["current", "past", "pending"]);

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
    const fromDb = await findResidenceByCitizenId(citizenId);
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

  const result = db.residenceRecords.findAll({ page, limit, citizenId });
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
    const address = String(body.address || "").trim();
    const type = String(body.type || "Thường trú") as ResidenceRecord["type"];
    const status = String(body.status || "current") as ResidenceRecord["status"];

    if (!citizenId || !address) {
      return NextResponse.json(
        { error: "Thiếu công dân hoặc địa chỉ" },
        { status: 400 },
      );
    }
    if (!RESIDENCE_TYPES.has(type) || !RESIDENCE_STATUSES.has(status)) {
      return NextResponse.json({ error: "Loại / trạng thái không hợp lệ" }, { status: 400 });
    }

    const startYear =
      body.startYear != null && body.startYear !== ""
        ? Number(body.startYear)
        : undefined;
    const endYear =
      body.endYear != null && body.endYear !== ""
        ? Number(body.endYear)
        : undefined;

    const fromDb = await insertResidenceRecord({
      citizenId,
      type,
      address,
      startYear: Number.isFinite(startYear) ? startYear : undefined,
      endYear: Number.isFinite(endYear) ? endYear : undefined,
      status,
      decisionNo: body.decisionNo ? String(body.decisionNo) : undefined,
      note: body.note ? String(body.note) : undefined,
    });
    if (fromDb) {
      return NextResponse.json(fromDb, { status: 201 });
    }

    const newRecord = db.residenceRecords.create({
      citizenId,
      type,
      address,
      startYear: Number.isFinite(startYear) ? startYear : undefined,
      endYear: Number.isFinite(endYear) ? endYear : undefined,
      status,
      decisionNo: body.decisionNo ? String(body.decisionNo) : undefined,
      note: body.note ? String(body.note) : undefined,
    });
    return NextResponse.json(newRecord, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
