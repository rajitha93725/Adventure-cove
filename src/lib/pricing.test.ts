import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { billableHours, buildBill, minutesUntilNextCharge, tieredCharge } from "./pricing.ts";

const rate = { firstHour: 1000, nextHour: 800, bufferMinutes: 15 };

describe("tiered hourly charge with 15-min buffer", () => {
  const cases: [number, number][] = [
    [0, 1000],
    [20, 1000],
    [60, 1000],
    [75, 1000], // 1h15
    [76, 1800], // 1h16
    [135, 1800], // 2h15
    [136, 2600], // 2h16
    [195, 2600], // 3h15
    [196, 3400],
  ];
  for (const [min, expected] of cases) {
    it(`${min} minutes -> Rs ${expected}`, () => {
      assert.equal(tieredCharge(min, rate).amount, expected);
    });
  }

  it("billable hours", () => {
    assert.equal(billableHours(75, 15), 1);
    assert.equal(billableHours(76, 15), 2);
  });

  it("minutes until next charge", () => {
    assert.equal(minutesUntilNextCharge(70, 15), 5);
    assert.equal(minutesUntilNextCharge(76, 15), 59);
  });
});

describe("buildBill", () => {
  const base = {
    play: { ...rate, warningMinutes: 5 },
    buddy: { ...rate, commissionPerHour: 150 },
    siblingDiscountPercent: 10,
    taxes: [],
    buddySessions: [],
    addOns: [],
  };

  it("applies sibling discount to 2nd child (lower play charge), play time only", () => {
    const bill = buildBill({
      ...base,
      now: "2026-01-01T12:20:00Z",
      sessions: [
        { childId: "a", childName: "A", startedAt: "2026-01-01T10:00:00Z" }, // 2h20 -> 2600
        { childId: "b", childName: "B", startedAt: "2026-01-01T11:30:00Z" }, // 50m -> 1000
      ],
      addOns: [{ childId: "b", kind: "vr", description: "VR", qty: 1, unitPrice: 500 }],
    });
    assert.equal(bill.subtotal, 4100);
    assert.equal(bill.discountTotal, 100);
    assert.equal(bill.total, 4000);
  });

  it("compounds taxes in order and computes buddy commission", () => {
    const bill = buildBill({
      ...base,
      now: "2026-01-01T11:30:00Z",
      taxes: [
        { name: "SC", rate: 10, enabled: true },
        { name: "VAT", rate: 18, enabled: true },
        { name: "Off", rate: 5, enabled: false },
      ],
      sessions: [{ childId: "a", childName: "A", startedAt: "2026-01-01T11:00:00Z" }],
      buddySessions: [
        { id: "x", childId: "a", childName: "A", staffName: "S", startedAt: "2026-01-01T10:00:00Z" },
      ], // 1h30 -> 1800, 2 hrs -> commission 300
    });
    assert.equal(bill.subtotal, 2800);
    assert.deepEqual(bill.taxLines.map((t) => t.amount), [280, 554.4]);
    assert.equal(bill.total, 3634.4);
    assert.deepEqual(bill.buddies[0], { id: "x", billedHours: 2, amount: 1800, commission: 300 });
  });
});
