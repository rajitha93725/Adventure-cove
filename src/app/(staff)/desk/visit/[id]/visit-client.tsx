"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LiveTimer, useNow } from "@/components/live";
import { money } from "@/lib/format";
import { elapsedMinutes, minutesUntilNextCharge, round2, type Bill, type BuddySession, type PlayPricing } from "@/lib/pricing";
import { addProduct, checkout, removeItem, startBuddy, stopBuddy } from "../../actions";

type Session = { childId: string; name: string; startedAt: string; allergies: string };
type Item = { id: string; childName: string; description: string; qty: number; unitPrice: number };
type Product = { id: string; name: string; category: string; price: number; stock_qty: number; track_stock: boolean; sku: string | null };
type Payment = { method: "cash" | "card" | "transfer"; amount: string; reference: string };

export default function VisitClient(props: {
  visitId: string;
  family: { id: string; parent_name: string; mobile: string };
  adults: number;
  canRemove: boolean;
  settingsPlay: PlayPricing;
  sessions: Session[];
  buddies: BuddySession[];
  items: Item[];
  bill: Bill;
  products: Product[];
  staff: { id: string; full_name: string }[];
}) {
  const { visitId, sessions, bill } = props;
  const router = useRouter();
  const now = useNow(1000);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // add-on form
  const [childId, setChildId] = useState<string>(sessions[0]?.childId ?? "");
  const [filter, setFilter] = useState("");
  const [qty, setQty] = useState(1);
  const [buddyStaff, setBuddyStaff] = useState("");

  // checkout
  const [showPay, setShowPay] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([{ method: "cash", amount: "", reference: "" }]);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError("");
    const res = await fn();
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Failed");
    else router.refresh();
    return res;
  };

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return props.products.filter((p) => !f || p.name.toLowerCase().includes(f) || p.sku?.toLowerCase() === f);
  }, [filter, props.products]);

  const paid = round2(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0));

  async function doCheckout() {
    setBusy(true);
    setError("");
    const res = await checkout(visitId, payments.map((p) => ({ ...p, amount: Number(p.amount) })));
    setBusy(false);
    if (res.ok && res.data) router.push(`/invoice/${res.data.invoiceId}?done=1`);
    else if (!res.ok) setError(res.error);
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/desk/family/${props.family.id}`} className="h1 hover:text-brand">
            {props.family.parent_name}
          </Link>
          <p className="text-muted">
            {props.family.mobile} {props.adults > 0 && `· ${props.adults} adult(s) free`}
          </p>
        </div>
        <Link href={`/desk/family/${props.family.id}`} className="btn-ghost">
          + Check in another sibling
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          {/* timers */}
          <div className="card">
            <h2 className="mb-2 font-bold">Play time</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {sessions.map((s) => {
                const left = minutesUntilNextCharge(elapsedMinutes(s.startedAt, new Date(now)), props.settingsPlay.bufferMinutes);
                const warn = left <= props.settingsPlay.warningMinutes;
                return (
                  <div key={s.childId} className={`rounded-xl border p-3 ${warn ? "border-warn bg-warn/10" : "border-line"}`}>
                    <div className="flex justify-between">
                      <strong>{s.name}</strong>
                      <span className="text-2xl"><LiveTimer since={s.startedAt} /></span>
                    </div>
                    <p className="text-sm text-muted">
                      Next hour charged in {left} min
                    </p>
                    {s.allergies && <p className="text-sm font-semibold text-danger">⚠ {s.allergies}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* add-ons */}
          <div className="card space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-bold">Add to bill</h2>
              <label className="text-sm text-muted">for</label>
              <select className="input w-auto" value={childId} onChange={(e) => setChildId(e.target.value)}>
                {sessions.map((s) => (
                  <option key={s.childId} value={s.childId}>{s.name}</option>
                ))}
                <option value="">Family (no child)</option>
              </select>
              <input type="number" min={1} className="input w-20" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} />
            </div>
            <input className="input" placeholder="Search product or scan barcode…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="grid max-h-72 grid-cols-2 gap-2 overflow-auto sm:grid-cols-3">
              {shown.map((p) => {
                const out = p.track_stock && p.stock_qty < qty;
                return (
                  <button
                    key={p.id}
                    disabled={busy || out}
                    className={`rounded-xl border p-2 text-left transition hover:border-brand disabled:opacity-40 ${p.category === "vr" ? "border-accent/50 bg-accent/5" : "border-line"}`}
                    onClick={() => run(() => addProduct(visitId, childId || null, p.id, qty))}
                  >
                    <div className="font-semibold leading-tight">{p.name}</div>
                    <div className="text-sm text-muted">
                      {money(p.price)} {p.track_stock && `· ${p.stock_qty} left`}
                    </div>
                  </button>
                );
              })}
              {shown.length === 0 && <p className="text-sm text-muted">No products. Add them in Admin → Products.</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <strong>Staff buddy</strong>
              <select className="input w-auto" value={buddyStaff} onChange={(e) => setBuddyStaff(e.target.value)}>
                <option value="">Select staff…</option>
                {props.staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
              <button
                className="btn-ghost"
                disabled={busy || !buddyStaff || !childId}
                onClick={() => run(() => startBuddy(visitId, childId, buddyStaff))}
              >
                Start buddy
              </button>
            </div>
            {props.buddies.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl bg-bg px-3 py-2 text-sm">
                <span>
                  {b.staffName} with {b.childName} · <LiveTimer since={b.startedAt} until={b.endedAt} />
                </span>
                {!b.endedAt ? (
                  <button className="btn-ghost py-1" disabled={busy} onClick={() => run(() => stopBuddy(visitId, b.id))}>
                    Stop
                  </button>
                ) : (
                  <span className="text-muted">ended</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* bill */}
        <div className="card h-fit space-y-3 lg:sticky lg:top-20">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">Running bill</h2>
            <span className="text-xs text-muted">updates live</span>
          </div>
          <table className="table">
            <tbody>
              {bill.lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <div className="font-semibold">{l.childName || "Family"}</div>
                    <div className="text-muted">
                      {l.description}
                      {l.kind !== "play" && l.kind !== "buddy" && l.qty > 1 && ` × ${l.qty}`}
                    </div>
                    {l.discount > 0 && <div className="text-ok">− {money(l.discount)} {l.discountReason}</div>}
                  </td>
                  <td className="text-right whitespace-nowrap">{money(l.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(bill.subtotal)}</dd></div>
            {bill.discountTotal > 0 && <div className="flex justify-between text-ok"><dt>Discounts</dt><dd>− {money(bill.discountTotal)}</dd></div>}
            {bill.taxLines.map((t) => (
              <div key={t.name} className="flex justify-between"><dt>{t.name} ({t.rate}%)</dt><dd>{money(t.amount)}</dd></div>
            ))}
            <div className="flex justify-between border-t border-line pt-2 text-xl font-extrabold"><dt>Total</dt><dd>{money(bill.total)}</dd></div>
          </dl>

          {props.items.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">Added items ({props.items.length})</summary>
              <ul className="mt-2 space-y-1">
                {props.items.map((i) => (
                  <li key={i.id} className="flex justify-between">
                    <span>{i.childName}: {i.description} × {i.qty}</span>
                    {props.canRemove && (
                      <button className="text-danger" disabled={busy} onClick={() => run(() => removeItem(visitId, i.id))}>
                        remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {!showPay ? (
            <button
              className="btn-accent w-full py-3 text-lg"
              onClick={() => {
                router.refresh();
                setPayments([{ method: "cash", amount: String(bill.total), reference: "" }]);
                setShowPay(true);
              }}
            >
              Checkout
            </button>
          ) : (
            <div className="space-y-2 rounded-xl border border-accent/40 bg-accent/5 p-3">
              <p className="text-sm text-muted">The final amount is recalculated when you confirm.</p>
              {payments.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    className="input w-28"
                    value={p.method}
                    onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, method: e.target.value as Payment["method"] } : x)))}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="transfer">Transfer / QR</option>
                  </select>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={p.amount}
                    onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                  />
                  {p.method !== "cash" && (
                    <input
                      className="input"
                      placeholder="Ref"
                      value={p.reference}
                      onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, reference: e.target.value } : x)))}
                    />
                  )}
                  {payments.length > 1 && (
                    <button className="text-danger" onClick={() => setPayments(payments.filter((_, j) => j !== i))}>✕</button>
                  )}
                </div>
              ))}
              <button
                className="text-sm font-semibold text-brand"
                onClick={() => setPayments([...payments, { method: "card", amount: String(Math.max(0, round2(bill.total - paid))), reference: "" }])}
              >
                + Split payment
              </button>
              <div className="flex justify-between text-sm">
                <span>Paid {money(paid)}</span>
                <span className={paid >= bill.total ? "font-bold text-ok" : "font-bold text-danger"}>
                  {paid >= bill.total ? `Change ${money(round2(paid - bill.total))}` : `Short ${money(round2(bill.total - paid))}`}
                </span>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => setShowPay(false)}>Cancel</button>
                <button className="btn-primary flex-1" disabled={busy} onClick={doCheckout}>
                  {busy ? "Processing…" : "Confirm & create invoice"}
                </button>
              </div>
            </div>
          )}
          {error && <p className="text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}
