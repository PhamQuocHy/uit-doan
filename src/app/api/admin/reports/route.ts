import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Mocking report data directly since this requires a complex DB aggregation usually
  const data = {
    overview: {
      totalCitizens: 12500,
      availableForDraft: 3200,
      deferred: 4500,
      inService: 620,
    },
    recruitmentStatsByYear: [
      { year: "2023", called: 1200, passed: 400, enlisted: 350 },
      { year: "2024", called: 1250, passed: 410, enlisted: 360 },
      { year: "2025", called: 1450, passed: 450, enlisted: 420 },
      { year: "2026", called: 1500, passed: 0, enlisted: 0 },
    ],
    defermentReasons: [
      { reason: "Học tập (ĐH/CĐ)", value: 2500, percentage: 55 },
      { reason: "Sức khỏe không đạt", value: 1200, percentage: 27 },
      { reason: "Hoàn cảnh gia đình", value: 500, percentage: 11 },
      { reason: "Chưa đủ tuổi", value: 300, percentage: 7 },
    ]
  };

  return NextResponse.json(data);
}
