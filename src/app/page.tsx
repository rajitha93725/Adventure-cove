import Link from "next/link";

// Temporary landing page – the full Hygraph-powered public website is Phase 3.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-brand-strong p-6 text-center text-white">
      <h1 className="text-5xl font-extrabold">Adventure Cove</h1>
      <p className="text-2xl text-sun">Play Smart, Big Adventures</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/register" className="btn-accent px-6 py-3 text-lg">Register your family</Link>
        <Link href="/login" className="btn bg-white/10 px-6 py-3 text-lg hover:bg-white/20">Staff login</Link>
      </div>
    </main>
  );
}
