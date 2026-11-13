import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DonePage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  if (!f || !/^[0-9a-f-]{36}$/.test(f)) notFound();
  const { data: fam } = await supabaseAdmin()
    .from("families")
    .select("created_at, children(first_name, qr_token)")
    .eq("id", f)
    .maybeSingle();
  // only shown right after registering (link is not a long-term login)
  if (!fam || Date.now() - new Date(fam.created_at).getTime() > 30 * 60 * 1000) notFound();
  const kids = fam.children as { first_name: string; qr_token: string }[];
  return (
    <main className="mx-auto max-w-lg space-y-4 p-4 text-center">
      <h1 className="h1 text-brand">You&apos;re registered! 🎉</h1>
      <p>Open each child&apos;s QR card and save it to your phone. Show it at the desk to check in.</p>
      <div className="space-y-2">
        {kids.map((k) => (
          <Link key={k.qr_token} href={`/my-card/${k.qr_token}`} className="btn-primary w-full">
            {k.first_name}&apos;s QR card
          </Link>
        ))}
      </div>
      <p className="text-sm text-muted">A printed card can also be collected at the front desk.</p>
    </main>
  );
}
