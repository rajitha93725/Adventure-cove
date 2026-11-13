import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { elapsedMinutes, minutesUntilNextCharge } from "@/lib/pricing";
import { LiveTimer, RealtimeRefresh } from "@/components/live";
import DeskSearch from "./desk-search";

export const dynamic = "force-dynamic";

export default async function DeskPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams;
  const db = supabaseAdmin();
  const [{ data: visits }, settings] = await Promise.all([
    db
      .from("visits")
      .select("id, opened_at, adults_count, families(parent_name, mobile), play_sessions(id, started_at, ended_at, children(first_name, allergies))")
      .eq("status", "open")
      .order("opened_at"),
    getSettings(),
  ]);

  type Row = {
    id: string;
    opened_at: string;
    adults_count: number;
    families: { parent_name: string; mobile: string };
    play_sessions: { id: string; started_at: string; ended_at: string | null; children: { first_name: string; allergies: string } }[];
  };
  const rows = (visits ?? []) as unknown as Row[];
  const kidsInside = rows.reduce((n, v) => n + v.play_sessions.filter((s) => !s.ended_at).length, 0);
  const { bufferMinutes, warningMinutes } = settings.play_pricing;

  return (
    <div className="space-y-4">
      <RealtimeRefresh tables={["visits", "play_sessions"]} />
      {denied && <p className="rounded-xl bg-warn/15 p-3">You don&apos;t have access to that page.</p>}
      <DeskSearch />

      <div className="flex items-end justify-between">
        <h2 className="h1">Children in play area</h2>
        <span className="badge bg-brand/10 text-base text-brand">{kidsInside} inside · {rows.length} families</span>
      </div>

      {rows.length === 0 && <p className="card text-muted">No active visits.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((v) => (
          <Link key={v.id} href={`/desk/visit/${v.id}`} className="card block transition hover:border-brand">
            <div className="flex items-baseline justify-between">
              <strong>{v.families.parent_name}</strong>
              <span className="text-sm text-muted">{v.families.mobile}</span>
            </div>
            <ul className="mt-2 space-y-1">
              {v.play_sessions.map((s) => {
                const left = minutesUntilNextCharge(elapsedMinutes(s.started_at), bufferMinutes);
                const warn = left <= warningMinutes;
                return (
                  <li key={s.id} className="flex items-center justify-between">
                    <span>
                      {s.children.first_name}
                      {s.children.allergies && <span className="badge ml-2 bg-danger/10 text-danger">allergy</span>}
                    </span>
                    <span className={warn ? "font-bold text-warn" : ""}>
                      <LiveTimer since={s.started_at} />
                    </span>
                  </li>
                );
              })}
            </ul>
            {v.adults_count > 0 && <p className="mt-1 text-xs text-muted">+ {v.adults_count} adult(s) (free)</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
