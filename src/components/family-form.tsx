"use client";
import { useState } from "react";

export type ChildDraft = {
  first_name: string;
  last_name: string;
  dob: string;
  gender: "male" | "female" | "other" | "";
  allergies: string;
  medical_notes: string;
};

const emptyChild = (): ChildDraft => ({
  first_name: "",
  last_name: "",
  dob: "",
  gender: "",
  allergies: "",
  medical_notes: "",
});

type Result = { ok: true; familyId: string } | { ok: false; error: string };

export function ChildFields({
  child,
  onChange,
  onRemove,
  index,
}: {
  child: ChildDraft;
  onChange: (c: ChildDraft) => void;
  onRemove?: () => void;
  index: number;
}) {
  const set = (k: keyof ChildDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...child, [k]: e.target.value });
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <strong>Child {index + 1}</strong>
        {onRemove && (
          <button type="button" className="text-sm text-danger" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">First name *</label>
          <input className="input" required value={child.first_name} onChange={set("first_name")} />
        </div>
        <div>
          <label className="label">Last name</label>
          <input className="input" value={child.last_name} onChange={set("last_name")} />
        </div>
        <div>
          <label className="label">Date of birth *</label>
          <input
            className="input"
            type="date"
            required
            max={new Date().toISOString().slice(0, 10)}
            value={child.dob}
            onChange={set("dob")}
          />
        </div>
        <div>
          <label className="label">Gender *</label>
          <select className="input" required value={child.gender} onChange={set("gender")}>
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Allergies</label>
          <input className="input" placeholder="e.g. peanuts, none" value={child.allergies} onChange={set("allergies")} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Medical notes</label>
          <textarea className="input" rows={2} value={child.medical_notes} onChange={set("medical_notes")} />
        </div>
      </div>
    </div>
  );
}

export default function FamilyForm({
  action,
  onDone,
  submitLabel = "Register",
}: {
  action: (data: unknown) => Promise<Result>;
  onDone: (familyId: string) => void;
  submitLabel?: string;
}) {
  const [parent, setParent] = useState({ parent_name: "", mobile: "", email: "", nic: "" });
  const [children, setChildren] = useState<ChildDraft[]>([emptyChild()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const setP = (k: keyof typeof parent) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setParent({ ...parent, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await action({ ...parent, children });
    setBusy(false);
    if (res.ok) onDone(res.familyId);
    else setError(res.error);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="card space-y-3">
        <h2 className="font-bold">Parent / guardian</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Full name *</label>
            <input className="input" required value={parent.parent_name} onChange={setP("parent_name")} />
          </div>
          <div>
            <label className="label">Mobile *</label>
            <input className="input" required inputMode="tel" placeholder="07XXXXXXXX" value={parent.mobile} onChange={setP("mobile")} />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" required value={parent.email} onChange={setP("email")} />
          </div>
          <div>
            <label className="label">NIC *</label>
            <input className="input" required value={parent.nic} onChange={setP("nic")} />
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">Children</h2>
        {children.map((c, i) => (
          <ChildFields
            key={i}
            index={i}
            child={c}
            onChange={(nc) => setChildren(children.map((x, j) => (j === i ? nc : x)))}
            onRemove={children.length > 1 ? () => setChildren(children.filter((_, j) => j !== i)) : undefined}
          />
        ))}
        <button type="button" className="btn-ghost" onClick={() => setChildren([...children, emptyChild()])}>
          + Add another child
        </button>
      </section>

      {error && <p className="rounded-xl bg-danger/10 p-3 text-danger">{error}</p>}
      <button className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
