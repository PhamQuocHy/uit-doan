import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/data";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.hierarchyLevel === "xa") return NextResponse.json({ error: "Không có quyền sửa chỉ tiêu" }, { status: 403 });
  const { id } = await context.params;
  const quota = db.quotas.findForUnit(session.unitCode, session.hierarchyLevel).find((item) => item.id === id && item.fromUnit === session.unitCode);
  if (!quota) return NextResponse.json({ error: "Không tìm thấy chỉ tiêu thuộc quyền quản lý" }, { status: 404 });
  const body = await request.json();
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Số chỉ tiêu không hợp lệ" }, { status: 400 });
  const updated = db.quotas.update(id, { amount, note: String(body.note || "") });
  return NextResponse.json({ data: updated });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.hierarchyLevel === "xa") return NextResponse.json({ error: "Không có quyền xóa chỉ tiêu" }, { status: 403 });
  const { id } = await context.params;
  const quota = db.quotas.findForUnit(session.unitCode, session.hierarchyLevel).find((item) => item.id === id && item.fromUnit === session.unitCode);
  if (!quota) return NextResponse.json({ error: "Không tìm thấy chỉ tiêu thuộc quyền quản lý" }, { status: 404 });
  db.quotas.delete(id);
  return NextResponse.json({ ok: true });
}