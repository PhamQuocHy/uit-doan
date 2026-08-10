import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLegalDocument } from "@/lib/legal-docs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const doc = await getLegalDocument(decodeURIComponent(id));
  if (!doc) {
    return NextResponse.json({ error: "Không tìm thấy văn bản" }, { status: 404 });
  }

  return NextResponse.json({ data: doc });
}
