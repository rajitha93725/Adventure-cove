"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChildFields, type ChildDraft } from "@/components/family-form";
import { addChildAction, checkIn } from "../../actions";

type Kid = {
  id: string;
  name: string;
  age: string;
  gender: string;
  allergies: string;
  medical: string;
  active: boolean;
};

export default function CheckInPanel({
  familyId,
  kids,
  scannedChildId,
}: {
  familyId: string;
  kids: Kid[];
  scannedChildId: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(scannedChildId && kids.some((k) => k.id === scannedChildId && !k.active) ? [scannedChildId] : []),
  );
  const [adults, setAdults] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newChild, setNewChild] = useState<ChildDraft | null>(null);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function doCheckIn() {
    setBusy(true);
    setError("");
    const res = await checkIn(familyId, [...selected], adults);
    setBusy(false);
    if (res.ok && res.data) router.push(`/desk/visit/${res.data.visitId}`);
    else if (!res.ok) setError(res.error);
  }

  async function saveChild() {
    if (!newChild) return;
    setBusy(true);
    setError("");
    const res = await addChildAction(familyId, newChild);
    setBusy(false);
    if (res.ok) {
      setNewChild(null);
      router.refresh();
    } else setError(res.error);
  }

  return (
    <div className="card space-y-4">
      <h2 className="font-bold">Select children to check in</h2>
      <div className="space-y-2">
        {kids.map((k) => (
          <label
            key={k.id}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
              selected.has(k.id) ? "border-brand bg-brand/5" : "border-line"
            } ${k.active ? "cursor-not-allowed opacity-60" : ""} ${k.id === scannedChildId ? "ring-2 ring-accent" : ""}`}
          >
            <input
              type="checkbox"
              className="mt-1 size-5 accent-[var(--brand)]"
              disabled={k.active}
              checked={selected.has(k.id)}
              onChange={() => toggle(k.id)}
            />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-lg">{k.name}</strong>
                <span className="text-muted">
                  {k.age} · <span className="capitalize">{k.gender}</span>
                </span>
                {k.active && <span className="badge bg-ok/15 text-ok">Playing now</span>}
              </div>
              {k.allergies && (
                <p className="mt-1 rounded-lg bg-danger/10 px-2 py-1 text-sm font-semibold text-danger">
                  ⚠ Allergies: {k.allergies}
                </p>
              )}
              {k.medical && <p className="mt-1 text-sm text-warn">Medical: {k.medical}</p>}
            </div>
          </label>
        ))}
      </div>

      {newChild ? (
        <div className="space-y-2">
          <ChildFields index={kids.length} child={newChild} onChange={setNewChild} onRemove={() => setNewChild(null)} />
          <button className="btn-ghost" disabled={busy} onClick={saveChild}>
            Save child
          </button>
        </div>
      ) : (
        <button
          className="btn-ghost"
          onClick={() =>
            setNewChild({ first_name: "", last_name: "", dob: "", gender: "", allergies: "", medical_notes: "" })
          }
        >
          + Add child to family
        </button>
      )}

      <div className="flex flex-wrap items-end gap-4 border-t border-line pt-4">
        <div>
          <label className="label">Accompanying adults (free)</label>
          <input
            type="number"
            min={0}
            max={10}
            className="input w-28"
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
          />
        </div>
        <button className="btn-primary px-8 py-3 text-lg" disabled={busy || selected.size === 0} onClick={doCheckIn}>
          {busy ? "Checking in…" : `Check in ${selected.size || ""} & start timer`}
        </button>
      </div>
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
