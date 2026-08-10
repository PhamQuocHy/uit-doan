import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/data";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = db.notifications.findForUnit(session.unitCode);
  const unread = list.filter((n) => !n.read).length;

  return NextResponse.json({ data: list, unread });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.all === true) {
    db.notifications.markAllRead(session.unitCode);
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    const n = db.notifications.markRead(String(body.id), session.unitCode);
    if (!n) {
      return NextResponse.json({ error: "Không tìm thấy thông báo" }, { status: 404 });
    }
    return NextResponse.json({ data: n });
  }

  return NextResponse.json({ error: "Thiếu tham số" }, { status: 400 });
}
