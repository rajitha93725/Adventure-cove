"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { childSchema, firstError, registerFamily } from "@/lib/families";
import { loadVisit } from "@/lib/visits";
import { normaliseMobile, parseQr } from "@/lib/format";
import { round2 } from "@/lib/pricing";

type R<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof Error ? e.message : String(e),
});

// ------------------------------------------------------------ registration
export async function registerFamilyAction(data: unknown) {
  await requireRole("cashier");
  return registerFamily(data, "desk");
}

export async function addChildAction(familyId: string, data: unknown): Promise<R> {
  try {
    await requireRole("cashier");
    const parsed = childSchema.safeParse(data);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const { error } = await supabaseAdmin().from("children").insert({ ...parsed.data, family_id: familyId });
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/desk/family/${familyId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------ lookup
export async function lookupQr(raw: string): Promise<R<{ familyId: string; childId: string }>> {
  try {
    await requireRole("staff");
    const token = parseQr(raw);
    if (!/^[0-9a-f]{18}$/.test(token)) return { ok: false, error: "Not an Adventure Cove card" };
    const { data } = await supabaseAdmin()
      .from("children")
      .select("id, family_id, active")
      .eq("qr_token", token)
      .maybeSingle();
    if (!data || !data.active) return { ok: false, error: "Card not found or deactivated" };
    return { ok: true, data: { familyId: data.family_id, childId: data.id } };
  } catch (e) {
    return fail(e);
  }
}

export type FamilyHit = { id: string; parent_name: string; mobile: string; kids: string };

export async function searchFamilies(q: string): Promise<R<FamilyHit[]>> {
  try {
    await requireRole("staff");
    const term = q.trim();
    if (term.length < 2) return { ok: true, data: [] };
    const db = supabaseAdmin();
    const like = `%${term.replace(/[%_,()."\\]/g, "")}%`;
    const digits = /\d{3,}/.test(term) ? normaliseMobile(term).replace(/^0/, "") : "";
    const famFilter = [`parent_name.ilike.${like}`, `nic.ilike.${like}`];
    if (digits) famFilter.push(`mobile.ilike.%${digits}%`);
    const ids = new Set<string>();
    const [fams, kids] = await Promise.all([
      db.from("families").select("id").or(famFilter.join(",")).limit(20),
      db.from("children").select("family_id").or(`first_name.ilike.${like},last_name.ilike.${like}`).limit(20),
    ]);
    fams.data?.forEach((f) => ids.add(f.id));
    kids.data?.forEach((k) => ids.add(k.family_id));
    if (!ids.size) return { ok: true, data: [] };
    const { data } = await db
      .from("families")
      .select("id, parent_name, mobile, children(first_name)")
      .in("id", [...ids])
      .limit(20);
    return {
      ok: true,
      data: (data ?? []).map((f) => ({
        id: f.id,
        parent_name: f.parent_name,
        mobile: f.mobile,
        kids: (f.children as { first_name: string }[]).map((c) => c.first_name).join(", "),
      })),
    };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------ check-in
export async function checkIn(familyId: string, childIds: string[], adults: number): Promise<R<{ visitId: string }>> {
  try {
    const staff = await requireRole("cashier");
    if (!childIds.length) return { ok: false, error: "Select at least one child" };
    const db = supabaseAdmin();

    const { data: kids } = await db
      .from("children")
      .select("id")
      .eq("family_id", familyId)
      .eq("active", true)
      .in("id", childIds);
    if ((kids?.length ?? 0) !== childIds.length) return { ok: false, error: "Child does not belong to this family" };

    let { data: visit } = await db
      .from("visits")
      .select("id")
      .eq("family_id", familyId)
      .eq("status", "open")
      .maybeSingle();
    if (!visit) {
      const ins = await db
        .from("visits")
        .insert({ family_id: familyId, opened_by: staff.id, adults_count: Math.max(0, adults) })
        .select("id")
        .single();
      if (ins.error) return { ok: false, error: ins.error.message };
      visit = ins.data;
    } else if (adults > 0) {
      await db.from("visits").update({ adults_count: Math.max(0, adults) }).eq("id", visit.id);
    }

    const { error } = await db
      .from("play_sessions")
      .insert(childIds.map((child_id) => ({ visit_id: visit!.id, child_id })));
    if (error) {
      return {
        ok: false,
        error: error.code === "23505" ? "One of these children is already checked in" : error.message,
      };
    }
    revalidatePath("/desk");
    return { ok: true, data: { visitId: visit.id } };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------ add-ons
export async function addProduct(visitId: string, childId: string | null, productId: string, qty: number): Promise<R> {
  try {
    const staff = await requireRole("cashier");
    if (!Number.isInteger(qty) || qty < 1) return { ok: false, error: "Quantity must be at least 1" };
    const { error } = await supabaseAdmin().rpc("add_product_item", {
      p_visit: visitId,
      p_child: childId,
      p_product: productId,
      p_qty: qty,
      p_staff: staff.id,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/desk/visit/${visitId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeItem(visitId: string, itemId: string): Promise<R> {
  try {
    const staff = await requireRole("manager");
    const { error } = await supabaseAdmin().rpc("remove_visit_item", { p_item: itemId, p_staff: staff.id });
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/desk/visit/${visitId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function startBuddy(visitId: string, childId: string, staffId: string): Promise<R> {
  try {
    await requireRole("cashier");
    const db = supabaseAdmin();
    const { data: v } = await db.from("visits").select("status").eq("id", visitId).single();
    if (v?.status !== "open") return { ok: false, error: "Visit is not open" };
    const { error } = await db.from("buddy_sessions").insert({ visit_id: visitId, child_id: childId, staff_id: staffId });
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/desk/visit/${visitId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function stopBuddy(visitId: string, buddyId: string): Promise<R> {
  try {
    await requireRole("cashier");
    const { error } = await supabaseAdmin()
      .from("buddy_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", buddyId)
      .is("ended_at", null);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/desk/visit/${visitId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------ checkout
const paymentsSchema = z
  .array(
    z.object({
      method: z.enum(["cash", "card", "transfer"]),
      amount: z.coerce.number().positive(),
      reference: z.string().trim().optional(),
    }),
  )
  .min(1, "Add a payment");

export async function checkout(visitId: string, rawPayments: unknown): Promise<R<{ invoiceId: string }>> {
  try {
    const staff = await requireRole("cashier");
    const parsed = paymentsSchema.safeParse(rawPayments);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const payments = parsed.data.map((p) => ({ ...p, amount: round2(p.amount) }));

    const now = new Date();
    const data = await loadVisit(visitId, now);
    if (!data || data.visit.status !== "open") return { ok: false, error: "Visit is not open" };
    if (!data.sessions.length) return { ok: false, error: "No children on this visit" };

    const { bill } = data;
    const paid = round2(payments.reduce((s, p) => s + p.amount, 0));
    const cash = round2(payments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0));
    if (paid < bill.total) return { ok: false, error: `Payment short by ${round2(bill.total - paid)}` };
    const change = round2(paid - bill.total);
    if (change > cash) return { ok: false, error: "Card/transfer amounts cannot exceed the bill (change only from cash)" };

    const { data: invoiceId, error } = await supabaseAdmin().rpc("finalize_checkout", {
      p_visit: visitId,
      p_staff: staff.id,
      p_ended_at: now.toISOString(),
      p_subtotal: bill.subtotal,
      p_discount: bill.discountTotal,
      p_tax_lines: bill.taxLines,
      p_tax_total: bill.taxTotal,
      p_total: bill.total,
      p_paid: paid,
      p_change: change,
      p_lines: bill.lines.map((l) => ({ ...l, childId: l.childId ?? "" })),
      p_payments: payments,
      p_buddies: bill.buddies,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/desk");
    return { ok: true, data: { invoiceId: invoiceId as string } };
  } catch (e) {
    return fail(e);
  }
}
