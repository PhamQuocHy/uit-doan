import { getSession } from "@/lib/auth";
import {
  getLatestScan,
  getSessionByCode,
  publicSession,
} from "@/lib/mobile/sessions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return new Response("code required", { status: 400 });
  }

  const admin = await getSession();
  if (!admin) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let lastPayload = "";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        const line = `data: ${JSON.stringify(data)}\n\n`;
        if (line === lastPayload) return;
        lastPayload = line;
        controller.enqueue(encoder.encode(line));
      };

      controller.enqueue(encoder.encode(": connected\n\n"));

      const tick = async () => {
        const row = await getSessionByCode(code);
        if (!row) {
          send({ status: "EXPIRED", error: "not_found" });
          return;
        }
        const session = publicSession(row);
        const scan =
          session.status === "COMPLETED" ? await getLatestScan(row.id) : null;
        send({
          ...session,
          result: scan
            ? {
                found: Boolean(scan.citizen),
                scanId: scan.scan_id,
                nfc: scan.nfc_json,
                ocr: scan.ocr_json,
                verification: scan.verification_json,
                citizenId: scan.citizen_id,
                citizen: scan.citizen,
              }
            : null,
        });
      };

      await tick();
      const interval = setInterval(() => {
        void tick().catch(() => {
          /* keep stream alive */
        });
      }, 1000);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* closed */
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
