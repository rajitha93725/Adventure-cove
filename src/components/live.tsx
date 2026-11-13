"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clock } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Re-renders every second. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function LiveTimer({ since, until }: { since: string; until?: string | null }) {
  const now = useNow();
  const end = until ? new Date(until).getTime() : now;
  return <span className="font-mono tabular-nums">{clock((end - new Date(since).getTime()) / 1000)}</span>;
}

/** Refreshes server components when visit-related tables change (Supabase Realtime) + every `fallbackMs`. */
export function RealtimeRefresh({ tables, fallbackMs = 30000 }: { tables: string[]; fallbackMs?: number }) {
  const router = useRouter();
  const key = tables.join(",");
  useEffect(() => {
    const sb = supabaseBrowser();
    const ch = sb.channel("refresh-" + key);
    key.split(",").forEach((table) =>
      ch.on("postgres_changes", { event: "*", schema: "public", table }, () => router.refresh()),
    );
    ch.subscribe();
    const t = setInterval(() => router.refresh(), fallbackMs);
    return () => {
      clearInterval(t);
      sb.removeChannel(ch);
    };
  }, [router, key, fallbackMs]);
  return null;
}
