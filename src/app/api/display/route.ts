import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Feed for the play-area TV. Protected by the display token in Admin → Settings.
 * Returns first names + start times only (no bills, no surnames).
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const settings = await getSettings();
  if (!token || token === "change-me" || token !== settings.display.token) {
    return NextResponse.json({ error: "Invalid display token" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin()
    .from("play_sessions")
    .select("id, started_at, children(first_name)")
    .is("ended_at", null)
    .order("started_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    serverTime: new Date().toISOString(),
    venue: settings.venue.name,
    tagline: settings.venue.tagline,
    bufferMinutes: settings.play_pricing.bufferMinutes,
    warningMinutes: settings.play_pricing.warningMinutes,
    kids: (data ?? []).map((s) => ({
      id: s.id,
      name: (s.children as unknown as { first_name: string }).first_name,
      startedAt: s.started_at,
    })),
  });
}
