import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePage, requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase/server";
import { tieredCharge } from "@/lib/pricing";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

const num = (f: FormData, k: string, min = 0) => {
  const n = Number(f.get(k));
  if (!Number.isFinite(n) || n < min) throw new Error(`${k} must be a number ≥ ${min}`);
  return n;
};

async function save(form: FormData) {
  "use server";
  const staff = await requireRole("owner");
  const taxes = [0, 1, 2].map((i) => ({
    name: String(form.get(`tax_name_${i}`) ?? "").trim(),
    rate: Number(form.get(`tax_rate_${i}`) || 0),
    enabled: form.get(`tax_on_${i}`) === "on",
  })).filter((t) => t.name);

  const rows = [
    {
      key: "play_pricing",
      value: {
        firstHour: num(form, "play_first"),
        nextHour: num(form, "play_next"),
        bufferMinutes: num(form, "play_buffer"),
        warningMinutes: num(form, "play_warning"),
      },
    },
    {
      key: "buddy_pricing",
      value: {
        firstHour: num(form, "buddy_first"),
        nextHour: num(form, "buddy_next"),
        bufferMinutes: num(form, "buddy_buffer"),
        commissionPerHour: num(form, "buddy_commission"),
      },
    },
    { key: "sibling_discount", value: { percent: Math.min(100, num(form, "sibling_pct")) } },
    { key: "taxes", value: taxes },
    {
      key: "venue",
      value: {
        name: String(form.get("venue_name")),
        tagline: String(form.get("venue_tagline")),
        address: String(form.get("venue_address")),
        phone: String(form.get("venue_phone")),
        bankDetails: String(form.get("venue_bank")),
        whatsapp: String(form.get("venue_whatsapp")),
      },
    },
    { key: "display", value: { token: String(form.get("display_token")).trim() || "change-me" } },
  ].map((r) => ({ ...r, updated_at: new Date().toISOString(), updated_by: staff.id }));

  const { error } = await supabaseAdmin().from("settings").upsert(rows);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect("/admin/settings?saved=1");
}

function Field({ label, name, value, type = "number", hint }: { label: string; name: string; value: string | number; type?: string; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" name={name} type={type} defaultValue={value} step={type === "number" ? "any" : undefined} min={type === "number" ? 0 : undefined} required={type === "number"} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const me = await requirePage("manager");
  const { saved } = await searchParams;
  const s = await getSettings();
  const p = s.play_pricing;
  const examples = [60, 75, 76, 135, 136, 195].map((m) => ({ m, ...tieredCharge(m, p) }));
  const canEdit = me.role === "owner";
  const taxes = [...s.taxes, { name: "", rate: 0, enabled: false }, { name: "", rate: 0, enabled: false }, { name: "", rate: 0, enabled: false }].slice(0, 3);

  return (
    <form action={save} className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="h1">Settings & pricing</h1>
        {canEdit ? <button className="btn-primary">Save all</button> : <span className="text-sm text-muted">Only the Owner can change settings.</span>}
      </div>
      {saved && <p className="rounded-xl bg-ok/10 p-3 text-ok">Saved. New prices apply immediately (including running sessions).</p>}

      <fieldset disabled={!canEdit} className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="font-bold">Play time</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First hour (Rs)" name="play_first" value={p.firstHour} />
            <Field label="Each next hour (Rs)" name="play_next" value={p.nextHour} />
            <Field label="Buffer minutes per hour" name="play_buffer" value={p.bufferMinutes} />
            <Field label="Display warning (min before)" name="play_warning" value={p.warningMinutes} />
          </div>
          <div className="rounded-xl bg-bg p-3 text-sm">
            <div className="mb-1 font-semibold text-muted">Current rule examples</div>
            {examples.map((e) => (
              <div key={e.m} className="flex justify-between">
                <span>{Math.floor(e.m / 60)}h {String(e.m % 60).padStart(2, "0")}m → {e.hours} hr</span>
                <span>{money(e.amount)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="font-bold">Staff buddy</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First hour (Rs)" name="buddy_first" value={s.buddy_pricing.firstHour} />
            <Field label="Each next hour (Rs)" name="buddy_next" value={s.buddy_pricing.nextHour} />
            <Field label="Buffer minutes" name="buddy_buffer" value={s.buddy_pricing.bufferMinutes} />
            <Field label="Staff commission / billed hour (Rs)" name="buddy_commission" value={s.buddy_pricing.commissionPerHour} />
          </div>
          <h2 className="pt-2 font-bold">Discounts</h2>
          <Field label="Sibling discount % (2nd child onwards, play time only)" name="sibling_pct" value={s.sibling_discount.percent} />
        </section>

        <section className="card space-y-3">
          <h2 className="font-bold">Taxes & service charge</h2>
          <p className="text-xs text-muted">Applied in this order, each on the running total (e.g. service charge first, then VAT).</p>
          {taxes.map((t, i) => (
            <div key={i} className="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
              <div>
                <label className="label">Name</label>
                <input className="input" name={`tax_name_${i}`} defaultValue={t.name} placeholder="e.g. VAT" />
              </div>
              <div>
                <label className="label">Rate %</label>
                <input className="input" name={`tax_rate_${i}`} type="number" step="any" min={0} defaultValue={t.rate} />
              </div>
              <label className="flex items-center gap-2 pb-2">
                <input type="checkbox" name={`tax_on_${i}`} defaultChecked={t.enabled} className="size-5" /> On
              </label>
            </div>
          ))}
        </section>

        <section className="card space-y-3">
          <h2 className="font-bold">Venue</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field type="text" label="Name" name="venue_name" value={s.venue.name} />
            <Field type="text" label="Tagline" name="venue_tagline" value={s.venue.tagline} />
            <Field type="text" label="Address" name="venue_address" value={s.venue.address} />
            <Field type="text" label="Phone" name="venue_phone" value={s.venue.phone} />
            <Field type="text" label="WhatsApp number (bookings)" name="venue_whatsapp" value={s.venue.whatsapp} />
            <Field type="text" label="Play-area display token" name="display_token" value={s.display.token} hint={`Open /display?token=… on the TV.`} />
          </div>
          <div>
            <label className="label">Bank account details (shown for online bookings)</label>
            <textarea className="input" name="venue_bank" rows={3} defaultValue={s.venue.bankDetails} />
          </div>
        </section>
      </fieldset>
    </form>
  );
}
