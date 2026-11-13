"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FamilyForm from "@/components/family-form";
import { publicRegister } from "./actions";

export default function PublicRegisterPage() {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <Link href="/" className="text-lg font-extrabold text-brand">Adventure Cove</Link>
      <div>
        <h1 className="h1">Register before you arrive</h1>
        <p className="text-muted">Skip the forms at the desk. You&apos;ll get a QR card for each child: arrive, scan, play.</p>
      </div>
      <FamilyForm action={publicRegister} submitLabel="Register" onDone={(id) => router.push(`/register/done?f=${id}`)} />
    </main>
  );
}
