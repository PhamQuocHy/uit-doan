import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/data";
import { isQuanKhuOrBtl } from "@/lib/military-regions";
import {
  deleteQuota,
  findQuotaById,
  updateQuota,
} from "@/lib/quotas-db";
import { syncOneReceivingFromRecruitment } from "@/lib/receiving-quotas-db";

function canManageQuota(
  session: { hierarchyLevel: string; unitCode: string },
  quota: { fromUnit: string },
): boolean {
  if (quota.fromUnit !== session.unitCode) return false;
  if (session.hierarchyLevel === "bo") return true;
  if (session.hierarchyLevel === "tinh" || session.hierarchyLevel === "huyen") {
    return true;
  }
  if (session.hierarchyLevel === "donvi" && isQuanKhuOrBtl(session.unitCode)) {
    return true;
  }
  return false;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const quota =
    (await findQuotaById(id)) ||
    db.quotas
      .findForUnit(session.unitCode, session.hierarchyLevel)
      .find((item) => item.id === id) ||
    null;

  if (!quota || !canManageQuota(session, quota)) {
    return NextResponse.json(
      { error: "Không tìm thấy chỉ tiêu thuộc quyền quản lý" },
      { status: 404 },
    );
  }

  const body = await request.json();
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Số chỉ tiêu không hợp lệ" },
      { status: 400 },
    );
  }

  const updated =
    (await updateQuota(id, {
      amount,
      note: String(body.note || ""),
    })) || db.quotas.update(id, { amount, note: String(body.note || "") });

  if (!updated) {
    return NextResponse.json({ error: "Không cập nhật được" }, { status: 404 });
  }

  if (
    session.hierarchyLevel === "bo" &&
    isQuanKhuOrBtl(updated.toUnit) &&
    updated.campaignId
  ) {
    await syncOneReceivingFromRecruitment(updated.campaignId, updated.toUnit);
  }

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const quota =
    (await findQuotaById(id)) ||
    db.quotas
      .findForUnit(session.unitCode, session.hierarchyLevel)
      .find((item) => item.id === id) ||
    null;

  if (!quota || !canManageQuota(session, quota)) {
    return NextResponse.json(
      { error: "Không có quyền xóa chỉ tiêu này" },
      { status: 403 },
    );
  }

  const campaignId = quota.campaignId;
  const toUnit = quota.toUnit;

  const fromDb = await deleteQuota(id);
  const fromMem = db.quotas.delete(id);
  if (!fromDb && !fromMem) {
    return NextResponse.json({ error: "Không xóa được" }, { status: 404 });
  }

  if (
    session.hierarchyLevel === "bo" &&
    campaignId &&
    isQuanKhuOrBtl(toUnit)
  ) {
    await syncOneReceivingFromRecruitment(campaignId, toUnit);
  }

  return NextResponse.json({ ok: true });
}
