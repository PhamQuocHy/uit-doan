/** Đồng bộ danh sách hồ sơ giữa các tab / vai trò (y tế, tuyển quân). */

export const CITIZENS_REALTIME_CHANNEL = "nvqs-citizens";

export type CitizensRealtimeMessage =
  | { type: "citizen-created"; id?: string; at?: number }
  | { type: "citizen-updated"; id?: string; at?: number }
  | { type: "citizens-changed"; at?: number };

export function publishCitizensChanged(
  message: CitizensRealtimeMessage = {
    type: "citizens-changed",
    at: Date.now(),
  },
): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return;
  }
  try {
    const ch = new BroadcastChannel(CITIZENS_REALTIME_CHANNEL);
    ch.postMessage({ ...message, at: message.at ?? Date.now() });
    ch.close();
  } catch {
    // ignore
  }
}

export function subscribeCitizensChanged(
  onMessage: (msg: CitizensRealtimeMessage) => void,
): () => void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return () => undefined;
  }
  try {
    const ch = new BroadcastChannel(CITIZENS_REALTIME_CHANNEL);
    ch.onmessage = (ev) => {
      const data = ev.data as CitizensRealtimeMessage | null;
      if (data && typeof data === "object" && "type" in data) {
        onMessage(data);
      }
    };
    return () => ch.close();
  } catch {
    return () => undefined;
  }
}
