import { withApiGuard } from "@/lib/security/api-guard";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pingDb } from "@/lib/db";
import { listCitizenCampaignHistory } from "@/lib/citizen-campaigns-db";

async function GETHandler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await pingDb())) {
    return NextResponse.json({ data: [] });
  }
  const { id } = await params;
  const data = await listCitizenCampaignHistory(id);
  return NextResponse.json({ data });
}

export const GET = withApiGuard(GETHandler);
