"use client";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function SignOut() {
  const router = useRouter();
  return (
    <button
      className="btn-ghost py-1 text-sm"
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
