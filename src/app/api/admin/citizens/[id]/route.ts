import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, hierarchyNeedsEditPin } from "@/lib/data";
import {
  findCitizenByIdFromDb,
  updateCitizenInDb,
} from "@/lib/citizens-db";
import { pingDb, queryExecute } from "@/lib/db";
import {
  resolveCallIntentUpdate,
  resetNvqsForNewCampaign,
  type CallIntent,
} from "@/lib/enlistment-approval";
import { verifyEditPinAsync } from "@/lib/unit-pin";
import { countCitizenNvqsAttachments } from "@/lib/citizen-nvqs-attachments-db";
import {
  snapshotFromCitizen,
  upsertCitizenCampaignHistory,
} from "@/lib/citizen-campaigns-db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const fromDb = await findCitizenByIdFromDb(id);
  const citizen = fromDb || db.citizens.findById(id);
  if (!citizen) {
    return NextResponse.json({ error: "Không tìm thấy công dân" }, { status: 404 });
  }
  return NextResponse.json(citizen);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const body = await request.json();
    const existing =
      (await findCitizenByIdFromDb(id)) || db.citizens.findById(id);
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy công dân" }, { status: 404 });
    }

    const updatesMilitaryStatus = body.militaryStatus !== undefined;
    const updatesCallIntent = body.callIntent !== undefined;
    const updatesReason = body.militaryStatusReason !== undefined;
    const touchesNvqs = updatesMilitaryStatus || updatesCallIntent || updatesReason;

    // Đã duyệt gọi nhập ngũ → không cho sửa hồ sơ (trừ Bộ mở khóa đặc biệt)
    const approvedLocked =
      existing.approvalStatus === "approved" &&
      (existing.militaryStatusLocked || existing.militaryStatus === "nhapngu");
    if (approvedLocked && session.hierarchyLevel !== "bo") {
      return NextResponse.json(
        {
          error:
            "Hồ sơ đã duyệt gọi nhập ngũ — không được sửa. Liên hệ cấp Bộ nếu cần điều chỉnh.",
        },
        { status: 403 },
      );
    }
    if (approvedLocked && session.hierarchyLevel === "bo" && body.unlockApproved !== true) {
      return NextResponse.json(
        {
          error:
            "Hồ sơ đã duyệt gọi. Gửi unlockApproved=true nếu cấp Bộ cần mở khóa chỉnh sửa.",
        },
        { status: 403 },
      );
    }

    // Cấp tỉnh / huyện / xã: bắt buộc PIN khi cập nhật hồ sơ
    if (hierarchyNeedsEditPin(session.hierarchyLevel)) {
      const pin = typeof body.editPin === "string" ? body.editPin : "";
      if (!(await verifyEditPinAsync(session.unitCode, pin))) {
        return NextResponse.json(
          { error: "Cần mã PIN địa phương hợp lệ để cập nhật hồ sơ" },
          { status: 403 },
        );
      }
    }

    if (existing.militaryStatusLocked && touchesNvqs) {
      const isBo = session.hierarchyLevel === "bo";
      const bypassLock = body.unlockViaProfile === true;

      if (!isBo && !bypassLock) {
        if (!hierarchyNeedsEditPin(session.hierarchyLevel)) {
          return NextResponse.json(
            { error: "Không thể cập nhật trạng thái NVQS đã khóa" },
            { status: 403 },
          );
        }
        // PIN đã xác thực ở trên cho cấp tỉnh/xã
      }
    }

    const {
      editPin: _editPin,
      unlockViaProfile: _unlock,
      requireEditPin: _reqPin,
      unlockApproved: _unlockApproved,
      ...safeBody
    } = body;
    const payload = { ...safeBody };

    // Đổi đợt khám tuyển → trạng thái xét duyệt đợt cũ hết hiệu lực, duyệt lại từ đầu
    const nextCampaignId =
      body.campaignId !== undefined ? String(body.campaignId || "") : undefined;
    const campaignChanged =
      nextCampaignId !== undefined &&
      nextCampaignId !== String(existing.campaignId || "");
    if (campaignChanged) {
      const reset = resetNvqsForNewCampaign(existing);
      if (reset) {
        Object.assign(payload, reset);
        // Giữ ghi chú / khóa mà client gửi kèm khi đề xuất lại trong đợt mới
        if (body.militaryStatusReason !== undefined) {
          payload.militaryStatusReason = body.militaryStatusReason;
        }
        if (body.militaryStatusLocked !== undefined) {
          payload.militaryStatusLocked = body.militaryStatusLocked;
        }
      }
    }

    if (updatesCallIntent || body.militaryStatus === "tamhoan" || body.militaryStatus === "miengoi") {
      if (body.militaryStatus === "miengoi") {
        payload.callIntent = "unset";
        payload.approvalStatus = "none";
        payload.militaryStatus = "miengoi";
        payload.approvalComment = null;
        const files = await countCitizenNvqsAttachments(id, "giay_mien_goi");
        if (files < 1) {
          return NextResponse.json(
            {
              error:
                "Miễn gọi cần tải lên ít nhất 1 giấy miễn gọi (minh chứng) trước khi lưu",
            },
            { status: 400 },
          );
        }
      } else if (body.militaryStatus === "tamhoan") {
        const note = String(body.militaryStatusReason || "").trim();
        if (!note) {
          return NextResponse.json(
            { error: "Vui lòng nhập ghi chú / lý do tạm hoãn kèm minh chứng" },
            { status: 400 },
          );
        }
        const files = await countCitizenNvqsAttachments(id, "giay_tam_hoan");
        if (files < 1) {
          return NextResponse.json(
            {
              error:
                "Đề xuất tạm hoãn cần tải lên ít nhất 1 giấy tạm hoãn (minh chứng) trước khi lưu",
            },
            { status: 400 },
          );
        }
        const resolved = resolveCallIntentUpdate("unset", "tamhoan");
        payload.callIntent = resolved.callIntent;
        payload.approvalStatus = resolved.approvalStatus;
        payload.pipelineStatus = resolved.pipelineStatus;
        payload.militaryStatus = "tamhoan";
        payload.approvalComment = null;
      } else {
        const callIntent = (body.callIntent || "unset") as CallIntent;
        const resolved = resolveCallIntentUpdate(
          callIntent,
          existing.militaryStatus,
        );

        if (resolved.callIntent === "de_xuat_khong_goi") {
          const note = String(body.militaryStatusReason || "").trim();
          if (!note) {
            return NextResponse.json(
              {
                error:
                  "Đề xuất không gọi cần ghi chú / lý do và tệp minh chứng (giấy khám SK…)",
              },
              { status: 400 },
            );
          }
          const files = await countCitizenNvqsAttachments(id, "giay_kham_suc_khoe");
          if (files < 1) {
            return NextResponse.json(
              {
                error:
                  "Đề xuất không gọi cần tải lên ít nhất 1 giấy khám sức khỏe (minh chứng) trước khi lưu",
              },
              { status: 400 },
            );
          }
        }

        payload.callIntent = resolved.callIntent;
        payload.approvalStatus = resolved.approvalStatus;
        payload.pipelineStatus = resolved.pipelineStatus;
        if (resolved.militaryStatus) {
          payload.militaryStatus = resolved.militaryStatus;
        }
        if (resolved.clearApprovalComment) {
          payload.approvalComment = null;
        }
      }
    }

    if (touchesNvqs && body.militaryStatusLocked !== false) {
      payload.militaryStatusLocked = true;
    }

    const updatedDb = await updateCitizenInDb(id, payload);
    if (updatedDb) {
      const nextCamp = String(updatedDb.campaignId || "").trim();
      if (nextCamp) {
        await upsertCitizenCampaignHistory({
          citizenId: id,
          campaignId: nextCamp,
          previous: campaignChanged ? snapshotFromCitizen(existing) : null,
          next: {
            callIntent: updatedDb.callIntent || "unset",
            approvalStatus: updatedDb.approvalStatus || "none",
            militaryStatus: updatedDb.militaryStatus || null,
            militaryStatusReason: updatedDb.militaryStatusReason || null,
            pipelineStatus: updatedDb.pipelineStatus || "none",
            note: campaignChanged
              ? "Gắn / chuyển đợt làm việc (giữ lịch sử đợt cũ)"
              : "Cập nhật trạng thái trong đợt",
          },
          source: "manual",
        });
      }
      return NextResponse.json(updatedDb);
    }

    const updated = db.citizens.update(id, payload);
    if (!updated) {
      return NextResponse.json({ error: "Không tìm thấy công dân" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Hồ sơ lưu vĩnh viễn: không xóa cứng. Hết tuổi → chuyển lưu trữ.
  if (await pingDb()) {
    const existing = await findCitizenByIdFromDb(id);
    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy công dân" }, { status: 404 });
    }
    if (existing.archivedAt) {
      return NextResponse.json(
        {
          error:
            "Hồ sơ đã lưu trữ vĩnh viễn — không xóa. Lịch sử khám/học vấn/cư trú được giữ để đối chiếu.",
        },
        { status: 400 },
      );
    }
    const { calcAgeYears, NVQS_AGE_MAX } = await import("@/lib/nvqs-age");
    if (calcAgeYears(existing.dateOfBirth) > NVQS_AGE_MAX) {
      const { archiveCitizensInDb } = await import("@/lib/citizens-db");
      const n = await archiveCitizensInDb([id]);
      if (n > 0) {
        return NextResponse.json({
          success: true,
          archived: true,
          message: "Đã chuyển hồ sơ hết tuổi sang Hồ sơ lưu trữ (không xóa dữ liệu).",
        });
      }
    }
    return NextResponse.json(
      {
        error:
          "Hồ sơ công dân lưu vĩnh viễn trong độ tuổi NVQS. Không xóa cứng — chỉ chuyển lưu trữ khi hết 27 tuổi.",
      },
      { status: 400 },
    );
  }

  const ok = db.citizens.delete(id);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy công dân" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
