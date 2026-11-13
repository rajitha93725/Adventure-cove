import "server-only";
import { supabaseAdmin } from "./supabase/server";
import type { BuddyPricing, PlayPricing, TaxSetting } from "./pricing";

export type Venue = {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  bankDetails: string;
  whatsapp: string;
};

export type Settings = {
  play_pricing: PlayPricing;
  buddy_pricing: BuddyPricing;
  sibling_discount: { percent: number };
  taxes: TaxSetting[];
  venue: Venue;
  display: { token: string };
};

export const DEFAULT_SETTINGS: Settings = {
  play_pricing: { firstHour: 1000, nextHour: 800, bufferMinutes: 15, warningMinutes: 5 },
  buddy_pricing: { firstHour: 1000, nextHour: 800, bufferMinutes: 15, commissionPerHour: 150 },
  sibling_discount: { percent: 10 },
  taxes: [],
  venue: {
    name: "Adventure Cove",
    tagline: "Play Smart, Big Adventures",
    address: "",
    phone: "",
    bankDetails: "",
    whatsapp: "",
  },
  display: { token: "change-me" },
};

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabaseAdmin().from("settings").select("key, value");
  if (error) throw new Error(error.message);
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const row of data ?? []) out[row.key] = row.value;
  return out as Settings;
}
