import "server-only";
import { z } from "zod";
import { supabaseAdmin } from "./supabase/server";
import { normaliseMobile } from "./format";

export const childSchema = z.object({
  first_name: z.string().trim().min(1, "Child first name is required"),
  last_name: z.string().trim().default(""),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Child date of birth is required")
    .refine((d) => new Date(d) <= new Date(), "Date of birth cannot be in the future"),
  gender: z.enum(["male", "female", "other"]),
  allergies: z.string().trim().default(""),
  medical_notes: z.string().trim().default(""),
});

export const familySchema = z.object({
  parent_name: z.string().trim().min(2, "Parent name is required"),
  mobile: z
    .string()
    .transform(normaliseMobile)
    .refine((m) => /^0\d{9}$/.test(m), "Enter a valid mobile number (e.g. 0771234567)"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  nic: z
    .string()
    .trim()
    .toUpperCase()
    .refine((n) => /^(\d{9}[VX]|\d{12})$/.test(n), "Enter a valid NIC (e.g. 901234567V or 199012345678)"),
  children: z.array(childSchema).min(1, "Add at least one child"),
});

export type FamilyInput = z.input<typeof familySchema>;
export type ActionResult = { ok: true; familyId: string } | { ok: false; error: string };

export function firstError(e: z.ZodError) {
  return e.issues[0]?.message ?? "Invalid input";
}

export async function registerFamily(raw: unknown, source: "desk" | "online"): Promise<ActionResult> {
  const parsed = familySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { children, ...family } = parsed.data;
  const db = supabaseAdmin();

  const { data: existing } = await db.from("families").select("id").eq("mobile", family.mobile).maybeSingle();
  if (existing) {
    return {
      ok: false,
      error:
        source === "desk"
          ? "A family with this mobile number already exists. Search for it and add the child there."
          : "This mobile number is already registered. Please ask the front desk to add more children.",
    };
  }

  const { data: fam, error } = await db
    .from("families")
    .insert({ ...family, source })
    .select("id")
    .single();
  if (error || !fam) return { ok: false, error: error?.message ?? "Could not save family" };

  const { error: cErr } = await db.from("children").insert(children.map((c) => ({ ...c, family_id: fam.id })));
  if (cErr) {
    await db.from("families").delete().eq("id", fam.id);
    return { ok: false, error: cErr.message };
  }
  return { ok: true, familyId: fam.id };
}
