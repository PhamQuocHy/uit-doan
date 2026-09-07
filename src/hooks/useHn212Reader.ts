"use client";

import { useCallback, useEffect, useState } from "react";
import {
  demoHn212Scan,
  getDefaultHn212WsUrl,
  getHn212Client,
  type Hn212CitizenScan,
  type Hn212ReadResult,
  type Hn212ReaderStatus,
} from "@/lib/hn212";

const DEFAULT_URL_SAFE = "ws://127.0.0.1:8000";

export function useHn212Reader() {
  const [status, setStatus] = useState<Hn212ReaderStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [wsUrl, setWsUrlState] = useState(DEFAULT_URL_SAFE);
  const [busy, setBusy] = useState(false);
  const [lastCardRaw, setLastCardRaw] = useState<unknown>(null);

  useEffect(() => {
    setWsUrlState(getDefaultHn212WsUrl());
    const client = getHn212Client();
    return client.onStatus((s, err, statusHint) => {
      setStatus(s);
      setError(err);
      setHint(statusHint);
      setEventLog(client.getEventLog());
      setLastCardRaw(client.getLastCardRaw());
    });
  }, []);

  const setWsUrl = useCallback((url: string) => {
    const client = getHn212Client();
    client.setWsUrl(url);
    setWsUrlState(client.getWsUrl());
  }, []);

  const connect = useCallback(
    async (overrideUrl?: string) => {
      const client = getHn212Client();
      client.setWsUrl(overrideUrl ?? wsUrl);
      if (overrideUrl) setWsUrlState(client.getWsUrl());
      return client.connect();
    },
    [wsUrl],
  );

  const scan = useCallback(async (): Promise<Hn212ReadResult> => {
    setBusy(true);
    setError(null);
    try {
      const client = getHn212Client();
      client.setWsUrl(wsUrl);
      const result = await client.readCardOnce(90000);
      setEventLog(client.getEventLog());
      setLastCardRaw(client.getLastCardRaw());
      return result;
    } finally {
      setBusy(false);
    }
  }, [wsUrl]);

  const demoScan = useCallback((): Hn212CitizenScan => {
    return demoHn212Scan();
  }, []);

  const disconnect = useCallback(() => {
    getHn212Client().disconnect();
  }, []);

  return {
    status,
    error,
    hint,
    eventLog,
    lastCardRaw,
    wsUrl,
    setWsUrl,
    busy,
    connect,
    scan,
    demoScan,
    disconnect,
    isDev: process.env.NODE_ENV === "development",
  };
}
