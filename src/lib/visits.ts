import "server-only";
import { supabaseAdmin } from "./supabase/server";
import { getSettings } from "./settings";
import { buildBill, type AddOn, type BuddySession, type ChildSession } from "./pricing";

export type VisitData = Awaited<ReturnType<typeof loadVisit>>;

export async function loadVisit(visitId: string, now: Date = new Date()) {
  const db = supabaseAdmin();
  const { data: visit, error } = await db
    .from("visits")
    .select("id, status, family_id, adults_count, opened_at, closed_at, families(id, parent_name, mobile, email)")
    .eq("id", visitId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!visit) return null;

  const [sessions, buddies, items, settings, children] = await Promise.all([
    db.from("play_sessions").select("id, child_id, started_at, ended_at").eq("visit_id", visitId).order("started_at"),
    db
      .from("buddy_sessions")
      .select("id, child_id, staff_id, started_at, ended_at, staff_profiles(full_name)")
      .eq("visit_id", visitId)
      .order("started_at"),
    db
      .from("visit_items")
      .select("id, child_id, type, description, qty, unit_price, created_at")
      .eq("visit_id", visitId)
      .order("created_at"),
    getSettings(),
    db
      .from("children")
      .select("id, first_name, last_name, dob, allergies, medical_notes")
      .eq("family_id", visit.family_id)
      .eq("active", true)
      .order("created_at"),
  ]);

  const kids = children.data ?? [];
  const nameOf = (id: string | null) => kids.find((c) => c.id === id)?.first_name ?? "";

  const childSessions: ChildSession[] = (sessions.data ?? []).map((s) => ({
    childId: s.child_id,
    childName: nameOf(s.child_id),
    startedAt: s.started_at,
  }));
  const buddySessions: BuddySession[] = (buddies.data ?? []).map((b) => ({
    id: b.id,
    childId: b.child_id,
    childName: nameOf(b.child_id),
    // supabase-js types joined rows loosely
    staffName: (b.staff_profiles as unknown as { full_name: string } | null)?.full_name ?? "Staff",
    startedAt: b.started_at,
    endedAt: b.ended_at,
  }));
  const addOns: AddOn[] = (items.data ?? []).map((i) => ({
    childId: i.child_id,
    childName: nameOf(i.child_id),
    kind: i.type === "vr" ? "vr" : i.type === "product" ? "product" : "other",
    description: i.description,
    qty: i.qty,
    unitPrice: Number(i.unit_price),
  }));

  const bill = buildBill({
    now,
    play: settings.play_pricing,
    buddy: settings.buddy_pricing,
    siblingDiscountPercent: settings.sibling_discount.percent,
    taxes: settings.taxes,
    sessions: childSessions,
    buddySessions,
    addOns,
  });

  return {
    visit,
    family: visit.families as unknown as { id: string; parent_name: string; mobile: string; email: string },
    children: kids,
    sessions: sessions.data ?? [],
    buddies: buddySessions,
    items: items.data ?? [],
    settings,
    bill,
  };
}
