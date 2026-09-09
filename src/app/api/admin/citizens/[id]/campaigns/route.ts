import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { pingDb } from "@/lib/db";
import { listCitizenCampaignHistory } from "@/lib/citizen-campaigns-db";

export async function GET(
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
