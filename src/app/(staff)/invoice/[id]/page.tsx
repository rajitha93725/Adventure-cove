import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { dateTime, money } from "@/lib/format";
import PrintButton from "@/components/print-button";

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { id } = await params;
  const { done } = await searchParams;
  const db = supabaseAdmin();
  const [{ data: inv }, settings] = await Promise.all([
    db
      .from("invoices")
      .select(
        "*, families(parent_name, mobile), invoice_lines(*, children(first_name)), payments(*), staff_profiles!invoices_created_by_fkey(full_name), visits(opened_at, closed_at, adults_count)",
      )
      .eq("id", id)
      .maybeSingle(),
    getSettings(),
  ]);
  if (!inv) notFound();
  type Line = { id: number; kind: string; description: string; qty: number; gross: number; discount: number; discount_reason: string | null; net: number; children: { first_name: string } | null };
  const lines = (inv.invoice_lines as Line[]).sort((a, b) => a.id - b.id);
  const payments = inv.payments as { id: number; method: string; amount: number; reference: string | null }[];
  const taxLines = inv.tax_lines as { name: string; rate: number; amount: number }[];
  const v = settings.venue;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {done && <p className="no-print rounded-xl bg-ok/10 p-3 font-semibold text-ok">Checkout complete. Timers stopped.</p>}
      <div className="no-print flex gap-2">
        <PrintButton />
        <Link href="/desk" className="btn-ghost">Back to desk</Link>
      </div>

      <div className="card space-y-4 print:border-0 print:shadow-none">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-brand">{v.name}</h1>
          <p className="text-sm text-muted">{v.tagline}</p>
          {v.address && <p className="text-sm">{v.address}</p>}
          {v.phone && <p className="text-sm">{v.phone}</p>}
        </div>
        <div className="flex justify-between text-sm">
          <div>
            <div className="font-bold">Invoice {inv.number}</div>
            <div>{dateTime(inv.created_at)}</div>
            {inv.voided_at && <div className="font-bold text-danger">VOID</div>}
          </div>
          <div className="text-right">
            <div className="font-semibold">{inv.families.parent_name}</div>
            <div>{inv.families.mobile}</div>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr><th>Item</th><th className="text-right">Amount</th></tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td>
                  <span className="font-semibold">{l.children?.first_name ?? "Family"}</span> – {l.description}
                  {(l.kind === "product" || l.kind === "vr") && Number(l.qty) > 1 && ` × ${Number(l.qty)}`}
                  {Number(l.discount) > 0 && (
                    <div className="text-xs text-ok">
                      {money(l.gross)} − {money(l.discount)} ({l.discount_reason})
                    </div>
                  )}
                </td>
                <td className="text-right whitespace-nowrap">{money(l.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(inv.subtotal)}</dd></div>
          {Number(inv.discount_total) > 0 && <div className="flex justify-between"><dt>Discounts</dt><dd>− {money(inv.discount_total)}</dd></div>}
          {taxLines.map((t) => (
            <div key={t.name} className="flex justify-between"><dt>{t.name} ({t.rate}%)</dt><dd>{money(t.amount)}</dd></div>
          ))}
          <div className="flex justify-between border-t border-line pt-2 text-lg font-extrabold"><dt>Total</dt><dd>{money(inv.total)}</dd></div>
          {payments.map((p) => (
            <div key={p.id} className="flex justify-between capitalize"><dt>Paid – {p.method}{p.reference ? ` (${p.reference})` : ""}</dt><dd>{money(p.amount)}</dd></div>
          ))}
          {Number(inv.change_due) > 0 && <div className="flex justify-between"><dt>Change</dt><dd>{money(inv.change_due)}</dd></div>}
        </dl>
        <p className="text-center text-xs text-muted">
          Served by {inv.staff_profiles?.full_name ?? "staff"} · Thank you for playing with us!
        </p>
      </div>
    </div>
  );
}
