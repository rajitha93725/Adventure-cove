import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { loadVisit } from "@/lib/visits";
import { getStaff, ROLE_RANK } from "@/lib/auth";
import { RealtimeRefresh } from "@/components/live";
import VisitClient from "./visit-client";

export const dynamic = "force-dynamic";

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadVisit(id);
  if (!data) notFound();
  if (data.visit.status !== "open") {
    const { data: inv } = await supabaseAdmin().from("invoices").select("id").eq("visit_id", id).maybeSingle();
    if (inv) redirect(`/invoice/${inv.id}`);
    notFound();
  }
  const db = supabaseAdmin();
  const [{ data: products }, { data: staff }, me] = await Promise.all([
    db.from("products").select("id, name, category, price, stock_qty, track_stock, sku").eq("active", true).order("category").order("name"),
    db.from("staff_profiles").select("id, full_name").eq("active", true).order("full_name"),
    getStaff(),
  ]);

  const nameOf = (cid: string | null) => data.children.find((c) => c.id === cid)?.first_name ?? "Family";

  return (
    <>
      <RealtimeRefresh tables={["visit_items", "buddy_sessions", "play_sessions"]} fallbackMs={15000} />
      <VisitClient
        visitId={id}
        family={data.family}
        adults={data.visit.adults_count}
        canRemove={!!me && ROLE_RANK[me.role] >= ROLE_RANK.manager}
        settingsPlay={data.settings.play_pricing}
        sessions={data.sessions.map((s) => ({
          childId: s.child_id,
          name: nameOf(s.child_id),
          startedAt: s.started_at,
          allergies: data.children.find((c) => c.id === s.child_id)?.allergies ?? "",
        }))}
        buddies={data.buddies}
        items={data.items.map((i) => ({
          id: i.id,
          childName: i.child_id ? nameOf(i.child_id) : "Family",
          description: i.description,
          qty: i.qty,
          unitPrice: Number(i.unit_price),
        }))}
        bill={data.bill}
        products={(products ?? []).map((p) => ({ ...p, price: Number(p.price) }))}
        staff={staff ?? []}
      />
    </>
  );
}
