import { NextRequest, NextResponse } from "next/server";
import { db, getChildUnits } from "@/lib/data";
import { getSession } from "@/lib/auth";
import { getUnitRecruitmentCapacity } from "@/lib/quota-capacity";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const capacityFor = searchParams.get("capacityFor");

  if (capacityFor) {
    const children = getChildUnits(session.unitCode);
    const allowed =
      session.hierarchyLevel === "bo" ||
      children.some((c) => c.code === capacityFor) ||
      capacityFor === session.unitCode;
    if (!allowed) {
      return NextResponse.json({ error: "Không có quyền xem đơn vị này" }, { status: 403 });
    }
    const capacity = await getUnitRecruitmentCapacity(capacityFor);
    return NextResponse.json({ capacity });
  }

  const quotas = db.quotas.findForUnit(session.unitCode, session.hierarchyLevel);
  const children = getChildUnits(session.unitCode).sort((a, b) =>
    a.name.localeCompare(b.name, "vi"),
  );

  return NextResponse.json({ data: quotas, childUnits: children });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.hierarchyLevel === "xa") {
    return NextResponse.json({ error: "Cấp xã không thể giao chỉ tiêu" }, { status: 403 });
  }

  const body = await request.json();
  const { toUnit, toUnitName, amount, year, note } = body;

  if (!toUnit || !toUnitName || !amount) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }

  const children = getChildUnits(session.unitCode);
  const validChild = children.find((c) => c.code === toUnit);
  if (!validChild) {
    return NextResponse.json(
      { error: "Đơn vị không hợp lệ hoặc không thuộc quyền quản lý" },
      { status: 400 },
    );
  }

  const qty = Number(amount);
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "Số chỉ tiêu không hợp lệ" }, { status: 400 });
  }

  const capacity = await getUnitRecruitmentCapacity(toUnit);
  const shortage = qty > capacity.eligible;
  const shortageAmount = Math.max(0, qty - capacity.eligible);

  const levelMap: Record<string, string> = { bo: "tinh", tinh: "xa", huyen: "xa" };

  const quota = db.quotas.create({
    year: year || new Date().getFullYear(),
    fromLevel: session.hierarchyLevel as "bo" | "tinh" | "xa",
    fromUnit: session.unitCode,
    toLevel: (levelMap[session.hierarchyLevel] || "tinh") as "bo" | "tinh" | "xa",
    toUnit,
    toUnitName: validChild.name || toUnitName,
    amount: qty,
    filled: 0,
    note: note || "",
  });

  // Thông báo luôn khi được giao chỉ tiêu
  db.notifications.create({
    toUnit,
    type: "quota_assigned",
    title: "Nhận chỉ tiêu tuyển quân mới",
    message: `${session.name} đã giao chỉ tiêu ${qty} cho ${validChild.name} (năm ${quota.year}).` +
      (shortage
        ? ` Cảnh báo: đơn vị chỉ có ${capacity.eligible}/${capacity.totalCitizens} hồ sơ đủ điều kiện — thiếu ${shortageAmount}.`
        : ` Hiện có ${capacity.eligible} hồ sơ đủ điều kiện tuyển.`),
    relatedQuotaId: quota.id,
  });

  // Thông báo riêng thiếu nguồn nếu không đủ
  if (shortage) {
    db.notifications.create({
      toUnit,
      type: "quota_shortage",
      title: "Cảnh báo thiếu nguồn tuyển quân",
      message:
        `Chỉ tiêu được giao: ${qty}, nhưng ${validChild.name} chỉ có ${capacity.eligible} hồ sơ đủ điều kiện ` +
        `(chưa khám / đang khám / đậu) trên tổng ${capacity.totalCitizens} hồ sơ. ` +
        `Thiếu khoảng ${shortageAmount}. Vui lòng rà soát, bổ sung nguồn hoặc báo cáo cấp trên.`,
      relatedQuotaId: quota.id,
    });
  }

  return NextResponse.json(
    {
      data: quota,
      capacity,
      warning: shortage
        ? {
            shortage: true,
            shortageAmount,
            eligible: capacity.eligible,
            totalCitizens: capacity.totalCitizens,
            message: `${validChild.name} chỉ có ${capacity.eligible} hồ sơ đủ điều kiện, thiếu ${shortageAmount} so với chỉ tiêu ${qty}. Đã gửi thông báo cho admin đơn vị nhận.`,
          }
        : null,
    },
    { status: 201 },
  );
}
