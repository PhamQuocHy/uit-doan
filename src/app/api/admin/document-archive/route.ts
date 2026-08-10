import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listLegalDocuments } from "@/lib/legal-docs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, source } = await listLegalDocuments();
  return NextResponse.json({ data, source, total: data.length });
}
