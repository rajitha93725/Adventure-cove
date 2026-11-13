import Link from "next/link";
import { requirePage, ROLE_RANK } from "@/lib/auth";
import SignOut from "./sign-out";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const staff = await requirePage("staff");
  const isManager = ROLE_RANK[staff.role] >= ROLE_RANK.manager;
  const links = [
    { href: "/desk", label: "Front desk" },
    { href: "/desk/register", label: "Register family" },
    ...(isManager
      ? [
          { href: "/admin/products", label: "Products" },
          { href: "/admin/staff", label: "Staff" },
          { href: "/admin/settings", label: "Settings" },
        ]
      : []),
  ];
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/desk" className="text-lg font-extrabold text-brand">
            Adventure Cove
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg px-3 py-1.5 font-semibold hover:bg-bg">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted">
              {staff.full_name} · <span className="capitalize">{staff.role}</span>
            </span>
            <SignOut />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">{children}</main>
    </div>
  );
}
