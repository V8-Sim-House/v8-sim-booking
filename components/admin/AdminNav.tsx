"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  return (
    <nav className="bg-brand-footer-bg border-b border-brand-border-subtle">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/admin/dashboard">
              <Image src="/v8_logo_red.png" alt="V8 Sim" width={80} height={28} className="h-7 w-auto" />
            </Link>
            <div className="flex items-center gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-md text-sm font-semibold uppercase tracking-wide transition-colors ${
                    pathname.startsWith(item.href)
                      ? "bg-brand-red text-white"
                      : "text-brand-text-muted hover:text-brand-text"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-brand-text-muted hover:text-brand-text uppercase tracking-widest transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
