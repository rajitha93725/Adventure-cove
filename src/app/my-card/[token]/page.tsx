import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import QrCard from "@/components/qr-card";

export const dynamic = "force-dynamic";

/** Public digital QR card. The URL token *is* the card, so only first name is shown. */
export default async function MyCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{18}$/.test(token)) notFound();
  const [{ data: child }, settings] = await Promise.all([
    supabaseAdmin().from("children").select("first_name, qr_token, active").eq("qr_token", token).maybeSingle(),
    getSettings(),
  ]);
  if (!child || !child.active) notFound();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <div className="origin-center scale-[1.15] sm:scale-150">
        <QrCard token={child.qr_token} firstName={child.first_name} lastName="" venueName={settings.venue.name} tagline={settings.venue.tagline} />
      </div>
      <p className="mt-8 max-w-xs text-center text-sm text-muted">
        Show this QR at the {settings.venue.name} front desk to check in. Tip: add this page to your home screen.
      </p>
    </main>
  );
}
