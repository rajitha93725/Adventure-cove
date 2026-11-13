import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ageFrom, dateTime, money } from "@/lib/format";
import CheckInPanel from "./check-in-panel";

export const dynamic = "force-dynamic";

export default async function FamilyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ child?: string; new?: string }>;
}) {
  const { id } = await params;
  const { child, new: isNew } = await searchParams;
  const db = supabaseAdmin();

  const [{ data: family }, { data: kids }, { data: openVisit }, { data: active }, { data: invoices }] = await Promise.all([
    db.from("families").select("*").eq("id", id).maybeSingle(),
    db.from("children").select("*").eq("family_id", id).eq("active", true).order("created_at"),
    db.from("visits").select("id").eq("family_id", id).eq("status", "open").maybeSingle(),
    db.from("play_sessions").select("child_id, visits!inner(family_id)").is("ended_at", null).eq("visits.family_id", id),
    db.from("invoices").select("id, number, total, created_at").eq("family_id", id).order("created_at", { ascending: false }).limit(5),
  ]);
  if (!family) notFound();

  const activeIds = new Set((active ?? []).map((a) => a.child_id));

  return (
    <div className="space-y-4">
      {isNew && <p className="rounded-xl bg-ok/10 p-3 text-ok">Family registered. Print QR cards and check the children in.</p>}

      <div className="card flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="h1">{family.parent_name}</h1>
          <p className="text-muted">
            {family.mobile} · {family.email} · NIC {family.nic}
          </p>
        </div>
        {openVisit && (
          <Link href={`/desk/visit/${openVisit.id}`} className="btn-accent">
            Open current visit →
          </Link>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <CheckInPanel
          familyId={family.id}
          scannedChildId={child ?? null}
          kids={(kids ?? []).map((k) => ({
            id: k.id,
            name: `${k.first_name} ${k.last_name}`.trim(),
            age: ageFrom(k.dob),
            gender: k.gender,
            allergies: k.allergies,
            medical: k.medical_notes,
            active: activeIds.has(k.id),
          }))}
        />

        <div className="space-y-4">
          <div className="card space-y-2">
            <h2 className="font-bold">QR cards</h2>
            {(kids ?? []).map((k) => (
              <div key={k.id} className="flex items-center justify-between">
                <span>{k.first_name}</span>
                <span className="flex gap-2">
                  <Link className="text-sm font-semibold text-brand" href={`/cards/${k.id}`} target="_blank">
                    Print card
                  </Link>
                  <Link className="text-sm font-semibold text-brand" href={`/my-card/${k.qr_token}`} target="_blank">
                    Digital link
                  </Link>
                </span>
              </div>
            ))}
          </div>
          <div className="card space-y-2">
            <h2 className="font-bold">Recent invoices</h2>
            {!invoices?.length && <p className="text-sm text-muted">No visits yet.</p>}
            {invoices?.map((i) => (
              <Link key={i.id} href={`/invoice/${i.id}`} className="flex justify-between text-sm hover:text-brand">
                <span>{i.number} · {dateTime(i.created_at)}</span>
                <span>{money(i.total)}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
