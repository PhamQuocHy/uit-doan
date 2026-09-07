import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hierarchyNeedsEditPin } from "@/lib/data";
import { verifyEditPinAsync } from "@/lib/unit-pin";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hierarchyNeedsEditPin(session.hierarchyLevel)) {
    return NextResponse.json({ ok: true, noPinRequired: true });
  }

  try {
    const { pin } = await request.json();
    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ error: "Vui lòng nhập mã PIN" }, { status: 400 });
    }

    const valid = await verifyEditPinAsync(session.unitCode, pin);
    if (!valid) {
      return NextResponse.json({ error: "Mã PIN không đúng" }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
}
