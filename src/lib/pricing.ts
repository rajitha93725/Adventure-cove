/**
 * Adventure Cove pricing engine (pure functions – shared by desk, display & checkout).
 *
 * Tiered hourly rule (all values from admin settings):
 *   - First hour charged at `firstHour`, each further hour at `nextHour`.
 *   - `bufferMinutes` grace at every hour boundary:
 *       0 – 1h15 → 1 hour, 1h16 – 2h15 → 2 hours, 2h16 – 3h15 → 3 hours …
 *   - Minimum = 1 hour.
 */

export type TieredRate = {
  firstHour: number;
  nextHour: number;
  bufferMinutes: number;
};

export type PlayPricing = TieredRate & { warningMinutes: number };
export type BuddyPricing = TieredRate & { commissionPerHour: number };
export type TaxSetting = { name: string; rate: number; enabled: boolean };

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Whole minutes elapsed (seconds are ignored: 75m 59s counts as 75m). */
export function elapsedMinutes(
  startedAt: Date | string | number,
  endedAt: Date | string | number = new Date(),
): number {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

export function billableHours(minutes: number, bufferMinutes: number): number {
  if (minutes <= 60 + bufferMinutes) return 1;
  return Math.ceil((minutes - bufferMinutes) / 60);
}

export function tieredCharge(minutes: number, rate: TieredRate) {
  const hours = billableHours(minutes, rate.bufferMinutes);
  const amount = rate.firstHour + (hours - 1) * rate.nextHour;
  return { hours, amount };
}

/** Minutes left before the next hour is charged (used by the live display warning). */
export function minutesUntilNextCharge(minutes: number, bufferMinutes: number): number {
  const hours = billableHours(minutes, bufferMinutes);
  const nextBoundary = hours * 60 + bufferMinutes; // last minute still covered
  return nextBoundary - minutes;
}

// ---------------------------------------------------------------- bill building

export type ChildSession = { childId: string; childName: string; startedAt: string };
export type BuddySession = {
  id: string;
  childId: string;
  childName: string;
  staffName: string;
  startedAt: string;
  endedAt?: string | null;
};
export type AddOn = {
  childId: string | null;
  childName?: string;
  kind: "vr" | "product" | "other";
  description: string;
  qty: number;
  unitPrice: number;
};

export type BillLine = {
  childId: string | null;
  childName?: string;
  kind: "play" | "buddy" | "vr" | "product" | "other";
  description: string;
  qty: number;
  unitPrice: number;
  gross: number;
  discount: number;
  discountReason: string | null;
  net: number;
  meta: Record<string, unknown>;
};

export type Bill = {
  lines: BillLine[];
  subtotal: number; // sum of gross
  discountTotal: number;
  taxLines: { name: string; rate: number; amount: number }[];
  taxTotal: number;
  total: number;
  buddies: { id: string; billedHours: number; amount: number; commission: number }[];
};

export type BillInput = {
  now: Date | string;
  play: PlayPricing;
  buddy: BuddyPricing;
  siblingDiscountPercent: number;
  taxes: TaxSetting[];
  sessions: ChildSession[];
  buddySessions: BuddySession[];
  addOns: AddOn[];
};

function fmtDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/**
 * Builds the family bill for a visit.
 * Sibling discount: the child with the HIGHEST play charge pays full price; every
 * other child (2nd onwards) gets `siblingDiscountPercent` off PLAY TIME only.
 * Taxes are applied in listed order, each on the running total (e.g. service
 * charge first, then VAT on subtotal + service charge).
 */
export function buildBill(input: BillInput): Bill {
  const lines: BillLine[] = [];

  // play time
  const play = input.sessions.map((s) => {
    const minutes = elapsedMinutes(s.startedAt, input.now);
    const { hours, amount } = tieredCharge(minutes, input.play);
    return { s, minutes, hours, amount };
  });
  const sorted = [...play].sort((a, b) => b.amount - a.amount);
  sorted.forEach((p, idx) => {
    const discount =
      idx > 0 && input.siblingDiscountPercent > 0
        ? round2((p.amount * input.siblingDiscountPercent) / 100)
        : 0;
    lines.push({
      childId: p.s.childId,
      childName: p.s.childName,
      kind: "play",
      description: `Play time ${fmtDuration(p.minutes)} (${p.hours} hr billed)`,
      qty: p.hours,
      unitPrice: round2(p.amount / p.hours),
      gross: p.amount,
      discount,
      discountReason: discount ? `Sibling ${input.siblingDiscountPercent}%` : null,
      net: round2(p.amount - discount),
      meta: { minutes: p.minutes, hours: p.hours, startedAt: p.s.startedAt },
    });
  });

  // staff buddy
  const buddies: Bill["buddies"] = [];
  for (const b of input.buddySessions) {
    const minutes = elapsedMinutes(b.startedAt, b.endedAt ?? input.now);
    const { hours, amount } = tieredCharge(minutes, input.buddy);
    const commission = round2(hours * input.buddy.commissionPerHour);
    buddies.push({ id: b.id, billedHours: hours, amount, commission });
    lines.push({
      childId: b.childId,
      childName: b.childName,
      kind: "buddy",
      description: `Staff buddy (${b.staffName}) ${fmtDuration(minutes)} (${hours} hr billed)`,
      qty: hours,
      unitPrice: round2(amount / hours),
      gross: amount,
      discount: 0,
      discountReason: null,
      net: amount,
      meta: { buddySessionId: b.id, minutes },
    });
  }

  // add-ons
  for (const a of input.addOns) {
    const gross = round2(a.qty * a.unitPrice);
    lines.push({
      childId: a.childId,
      childName: a.childName,
      kind: a.kind,
      description: a.description,
      qty: a.qty,
      unitPrice: a.unitPrice,
      gross,
      discount: 0,
      discountReason: null,
      net: gross,
      meta: {},
    });
  }

  const subtotal = round2(lines.reduce((s, l) => s + l.gross, 0));
  const discountTotal = round2(lines.reduce((s, l) => s + l.discount, 0));
  let running = round2(subtotal - discountTotal);
  const taxLines: Bill["taxLines"] = [];
  for (const t of input.taxes.filter((t) => t.enabled && t.rate > 0)) {
    const amount = round2((running * t.rate) / 100);
    taxLines.push({ name: t.name, rate: t.rate, amount });
    running = round2(running + amount);
  }
  const taxTotal = round2(taxLines.reduce((s, t) => s + t.amount, 0));
  return { lines, subtotal, discountTotal, taxLines, taxTotal, total: running, buddies };
}
