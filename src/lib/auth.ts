import "server-only";
import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "./supabase/server";

export type Role = "owner" | "manager" | "cashier" | "staff";
export type Staff = { id: string; full_name: string; email: string; role: Role };

export const ROLE_RANK: Record<Role, number> = { staff: 1, cashier: 2, manager: 3, owner: 4 };

export async function getStaff(): Promise<Staff | null> {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabaseAdmin()
    .from("staff_profiles")
    .select("id, full_name, email, role, active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile || !profile.active) return null;
  return profile as Staff;
}

/** For pages: redirect when not allowed. */
export async function requirePage(min: Role): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  if (ROLE_RANK[staff.role] < ROLE_RANK[min]) redirect("/desk?denied=1");
  return staff;
}

/** For server actions: throw when not allowed. */
export async function requireRole(min: Role): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) throw new Error("Not signed in");
  if (ROLE_RANK[staff.role] < ROLE_RANK[min]) throw new Error("You do not have permission for this action");
  return staff;
}
