"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Scanner from "@/components/scanner";
import { lookupQr, searchFamilies, type FamilyHit } from "./actions";

export default function DeskSearch() {
  const router = useRouter();
  const [hits, setHits] = useState<FamilyHit[] | null>(null);
  const [error, setError] = useState("");

  const onScan = useCallback(
    async (code: string) => {
      setError("");
      const res = await lookupQr(code);
      if (res.ok && res.data) router.push(`/desk/family/${res.data.familyId}?child=${res.data.childId}`);
      else if (!res.ok) setError(res.error);
    },
    [router],
  );

  const onSearch = useCallback(async (text: string) => {
    setError("");
    const res = await searchFamilies(text);
    if (res.ok) setHits(res.data ?? []);
    else setError(res.error);
  }, []);

  return (
    <div className="card space-y-3">
      <h2 className="font-bold">Check in</h2>
      <Scanner onScan={onScan} onSearch={onSearch} />
      {error && <p className="text-danger">{error}</p>}
      {hits && (
        <div className="divide-y divide-line">
          {hits.length === 0 && (
            <p className="py-2 text-muted">
              No family found. <Link className="font-semibold text-brand" href="/desk/register">Register a new family →</Link>
            </p>
          )}
          {hits.map((h) => (
            <Link key={h.id} href={`/desk/family/${h.id}`} className="flex justify-between py-2 hover:bg-bg">
              <span>
                <strong>{h.parent_name}</strong> <span className="text-muted">· {h.mobile}</span>
              </span>
              <span className="text-sm text-muted">{h.kids}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
