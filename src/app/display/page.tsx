"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { clock } from "@/lib/format";
import { elapsedMinutes, minutesUntilNextCharge } from "@/lib/pricing";

type Feed = {
  serverTime: string;
  venue: string;
  tagline: string;
  bufferMinutes: number;
  warningMinutes: number;
  kids: { id: string; name: string; startedAt: string }[];
};

function Board() {
  const token = useSearchParams().get("token") ?? "";
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState("");
  const [skew, setSkew] = useState(0); // server - client clock difference
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/display?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) return setError(j.error ?? "Error");
        setError("");
        setFeed(j);
        setSkew(new Date(j.serverTime).getTime() - Date.now());
      } catch {
        if (alive) setError("Connection lost – retrying…");
      }
    };
    load();
    const poll = setInterval(load, 5000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [token]);

  const t = now + skew;
  return (
    <main className="min-h-screen bg-brand-strong p-6 text-white">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-extrabold">{feed?.venue ?? "Adventure Cove"}</h1>
          <p className="text-xl text-sun">{feed?.tagline}</p>
        </div>
        <div className="text-right">
          <div className="text-5xl font-extrabold">{feed?.kids.length ?? 0}</div>
          <div className="opacity-80">adventurers playing</div>
        </div>
      </header>
      {error && <p className="mb-4 rounded-xl bg-danger p-3 text-lg">{error}</p>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {feed?.kids.map((k) => {
          const start = new Date(k.startedAt).getTime();
          const left = minutesUntilNextCharge(elapsedMinutes(start, t), feed.bufferMinutes);
          const warn = left <= feed.warningMinutes;
          return (
            <div
              key={k.id}
              className={`rounded-2xl p-4 text-center transition ${warn ? "animate-pulse bg-warn text-ink" : "bg-white/10"}`}
            >
              <div className="truncate text-2xl font-bold">{k.name}</div>
              <div className="font-mono text-4xl tabular-nums">{clock((t - start) / 1000)}</div>
              {warn && <div className="mt-1 text-sm font-semibold">Next hour starts in {left} min</div>}
            </div>
          );
        })}
      </div>
    </main>
  );
}

export default function DisplayPage() {
  return (
    <Suspense>
      <Board />
    </Suspense>
  );
}
