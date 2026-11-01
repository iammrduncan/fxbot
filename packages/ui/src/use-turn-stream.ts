import { applyLine, type Turn } from "@fxbot/sdk/client";
import { useEffect, useState } from "react";
import { client } from "./client.ts";

// A bot's thread, read from its stream from the start and followed while `live`.
export function useTurnStream(profileId: string, live: boolean) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    if (!live) return;
    const abort = new AbortController();
    (async () => {
      for await (const line of client.stream(profileId, { signal: abort.signal, onConnection: setConnected })) setTurns((turns) => applyLine(turns, line));
    })();
    return () => abort.abort();
  }, [profileId, live]);

  return { turns, setTurns, connected };
}
