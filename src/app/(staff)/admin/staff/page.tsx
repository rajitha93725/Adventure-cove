import { revalidatePath } from "next/cache";
import { requirePage, requireRole, type Role } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const ROLES: Role[] = ["owner", "manager", "cashier", "staff"];

async function addStaff(form: FormData) {
  "use server";
  await requireRole("owner");
  const email = String(form.get("email")).trim().toLowerCase();
  const password = String(form.get("password"));
  const full_name = String(form.get("full_name")).trim();
  const role = String(form.get("role")) as Role;
  if (!ROLES.includes(role)) throw new Error("Invalid role");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? "Could not create user");
  const { error: pErr } = await admin.from("staff_profiles").insert({ id: data.user.id, email, full_name, role });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new Error(pErr.message);
  }
  revalidatePath("/admin/staff");
}

async function updateStaff(form: FormData) {
  "use server";
  const me = await requireRole("owner");
  const id = String(form.get("id"));
  const role = String(form.get("role")) as Role;
  const active = form.get("active") === "on";
  if (!ROLES.includes(role)) throw new Error("Invalid role");
  if (id === me.id && (role !== "owner" || !active)) throw new Error("You cannot demote or deactivate yourself");
  await supabaseAdmin().from("staff_profiles").update({ role, active }).eq("id", id);
  revalidatePath("/admin/staff");
}

export default async function StaffPage() {
  const me = await requirePage("manager");
  const isOwner = me.role === "owner";
  const { data: staff } = await supabaseAdmin().from("staff_profiles").select("*").order("full_name");

  return (
    <div className="space-y-4">
      <h1 className="h1">Staff accounts</h1>
      <p className="text-sm text-muted">
        Owner: everything · Manager: operations, products, void items · Cashier: check-in, POS, checkout · Staff: view desk, buddy.
        Attendance & payroll come in Phase 4.
      </p>

      {isOwner && (
        <form action={addStaff} className="card grid items-end gap-3 sm:grid-cols-5">
          <div><label className="label">Full name</label><input name="full_name" className="input" required /></div>
          <div><label className="label">Email (login)</label><input name="email" type="email" className="input" required /></div>
          <div><label className="label">Temp password</label><input name="password" type="text" minLength={8} className="input" required /></div>
          <div>
            <label className="label">Role</label>
            <select name="role" className="input" defaultValue="cashier">
              {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
            </select>
          </div>
          <button className="btn-primary">Add staff</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th /></tr></thead>
          <tbody>
            {(staff ?? []).map((s) => (
              <tr key={s.id}>
                <td className="font-semibold">{s.full_name}</td>
                <td>{s.email}</td>
                {isOwner ? (
                  <td colSpan={3}>
                    <form action={updateStaff} className="flex items-center gap-3">
                      <input type="hidden" name="id" value={s.id} />
                      <select name="role" className="input w-32 py-1" defaultValue={s.role}>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={s.active} /> active</label>
                      <button className="btn-ghost py-1">Save</button>
                    </form>
                  </td>
                ) : (
                  <>
                    <td className="capitalize">{s.role}</td>
                    <td>{s.active ? "Yes" : "No"}</td>
                    <td />
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
