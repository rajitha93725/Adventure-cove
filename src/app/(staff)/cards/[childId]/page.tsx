import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import QrCard from "@/components/qr-card";
import PrintButton from "@/components/print-button";

export const dynamic = "force-dynamic";

export default async function CardPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const [{ data: child }, settings] = await Promise.all([
    supabaseAdmin().from("children").select("first_name, last_name, qr_token").eq("id", childId).maybeSingle(),
    getSettings(),
  ]);
  if (!child) notFound();
  return (
    <div className="space-y-4">
      <div className="no-print flex items-center gap-3">
        <PrintButton label="Print card" />
        <span className="text-sm text-muted">Use a card printer or print on card stock at 100% scale.</span>
      </div>
      <QrCard
        token={child.qr_token}
        firstName={child.first_name}
        lastName={child.last_name}
        venueName={settings.venue.name}
        tagline={settings.venue.tagline}
      />
    </div>
  );
}
