"use server";
import { headers } from "next/headers";
import { registerFamily } from "@/lib/families";

// Simple in-memory throttle per IP (good enough for a single instance; replace with
// a shared store / captcha when the public site goes live in Phase 3).
const hits = new Map<string, number[]>();

export async function publicRegister(data: unknown) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (recent.length >= 5) return { ok: false as const, error: "Too many registrations. Please try later or visit the desk." };
  hits.set(ip, [...recent, now]);
  return registerFamily(data, "online");
}
