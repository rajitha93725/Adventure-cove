import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function ownerExists() {
  const { count } = await supabaseAdmin()
    .from("staff_profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner");
  return (count ?? 0) > 0;
}

async function createOwner(form: FormData) {
  "use server";
  if (await ownerExists()) redirect("/login");
  const email = String(form.get("email")).trim().toLowerCase();
  const password = String(form.get("password"));
  const fullName = String(form.get("full_name")).trim();
  if (password.length < 8) redirect("/setup?e=Password+must+be+at+least+8+characters");
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) redirect("/setup?e=" + encodeURIComponent(error?.message ?? "Failed"));
  await admin.from("staff_profiles").insert({ id: data.user.id, full_name: fullName, email, role: "owner" });
  redirect("/login");
}

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await ownerExists()) redirect("/login");
  const { e } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={createOwner} className="card w-full max-w-sm space-y-4">
        <div>
          <h1 className="h1 text-brand">First-time setup</h1>
          <p className="text-sm text-muted">Create the Owner account. This page disappears once an owner exists.</p>
        </div>
        <div>
          <label className="label">Full name</label>
          <input name="full_name" className="input" required />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" className="input" required />
        </div>
        <div>
          <label className="label">Password (min 8)</label>
          <input name="password" type="password" minLength={8} className="input" required />
        </div>
        {e && <p className="text-sm text-danger">{e}</p>}
        <button className="btn-primary w-full">Create owner</button>
      </form>
    </main>
  );
}
