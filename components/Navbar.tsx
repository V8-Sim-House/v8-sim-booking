"use client";
import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="absolute top-0 left-0 right-0 z-50 py-6">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/v8_logo_red.png"
            alt="V8 Sim"
            width={120}
            height={40}
            className="h-10 w-auto"
            style={{ width: "auto" }}
          />
        </Link>
        <div className="flex items-center gap-6 text-sm text-brand-text/80 tracking-wide uppercase font-semibold">
          <a
            href="https://v8simhouse.com"
            className="hover:text-brand-text transition-colors hidden sm:inline"
          >
            Back to Site
          </a>
          <Link
            href="/book"
            className="border border-brand-red text-brand-red px-5 py-2 rounded-full text-xs tracking-widest hover:bg-brand-red hover:text-white transition-all duration-200"
          >
            Book Now
          </Link>
        </div>
      </div>
    </nav>
  );
}
