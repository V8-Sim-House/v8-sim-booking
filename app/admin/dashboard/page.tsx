"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/admin/AdminNav";
import { formatCurrency } from "@/lib/pricing";
import type { SimBooking } from "@/types/booking";

interface Stats {
  total: number;
  pending: number;
  approved: number;
  revenue: number;
}

export default function DashboardPage() {
  const [bookings, setBookings] = useState<SimBooking[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("sim_bookings")
      .select("*, clients(*), sim_booking_addons(*)")
      .order("created_at", { ascending: false })
      .limit(50);

    const all = (data ?? []) as SimBooking[];
    setBookings(all);

    const pending = all.filter((b) => b.status === "pending").length;
    const approved = all.filter((b) => b.status === "approved").length;
    const revenue = all
      .filter((b) => b.status === "approved" || b.status === "completed")
      .reduce((sum, b) => sum + (b.deposit_amount ?? 0), 0);

    setStats({ total: all.length, pending, approved, revenue });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const pendingBookings = bookings.filter((b) => b.status === "pending");
  const upcomingBookings = bookings
    .filter((b) => b.status === "approved" && b.event_date >= new Date().toISOString().split("T")[0])
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 5);

  // Check for pending bookings older than 5 days (Stripe hold expires in 7)
  const expiringSoon = pendingBookings.filter((b) => {
    const created = new Date(b.created_at);
    const diff = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 5;
  });

  const handleQuickAction = async (id: string, action: "approve" | "decline") => {
    if (actionInProgress) return;
    setActionInProgress(`${id}-${action}`);
    const res = await fetch(`/api/bookings/${id}/${action}`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || `Failed to ${action} booking`);
    }
    setActionInProgress(null);
    load();
  };

  const STAT_CARDS = [
    { label: "Total Bookings", value: stats.total, color: "text-brand-text" },
    { label: "Pending Review", value: stats.pending, color: "text-yellow-400" },
    { label: "Approved", value: stats.approved, color: "text-green-400" },
    { label: "Revenue Collected", value: formatCurrency(stats.revenue), color: "text-brand-red" },
  ];

  return (
    <div className="min-h-screen bg-brand-black">
      <AdminNav />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-brand-text mb-8">Dashboard</h1>

        {/* Expiry warning */}
        {expiringSoon.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6 flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-yellow-400 font-semibold text-sm">Stripe Hold Expiring Soon</p>
              <p className="text-yellow-400/70 text-xs mt-0.5">
                {expiringSoon.length} pending booking{expiringSoon.length > 1 ? "s are" : " is"} approaching the 7-day Stripe authorization limit. Approve or decline soon to avoid hold expiry.
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {STAT_CARDS.map((s) => (
            <div key={s.label} className="v8-card p-5">
              <p className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">{s.label}</p>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pending bookings */}
          <div>
            <h2 className="text-sm uppercase tracking-widest text-brand-text-muted font-semibold mb-4">
              Pending Requests ({pendingBookings.length})
            </h2>
            {loading ? (
              <p className="text-brand-text-muted text-sm">Loading...</p>
            ) : pendingBookings.length === 0 ? (
              <div className="v8-card p-6 text-center text-brand-text-muted text-sm">No pending bookings</div>
            ) : (
              <div className="space-y-3">
                {pendingBookings.slice(0, 8).map((b) => (
                  <div key={b.id} className="v8-card p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-semibold text-brand-text text-sm">{b.clients?.full_name}</p>
                        <p className="text-brand-text-muted text-xs">{b.event_date} · {b.package_type?.replace(/_/g, " ")}</p>
                        <p className="text-brand-text-muted text-xs">{formatCurrency(b.subtotal ?? 0)}</p>
                      </div>
                      <Link href={`/admin/bookings/${b.id}`} className="text-xs text-brand-red hover:underline shrink-0">
                        View →
                      </Link>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleQuickAction(b.id, "approve")}
                        disabled={!!actionInProgress}
                        className="flex-1 text-xs py-1.5 rounded-md bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors font-semibold uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionInProgress === `${b.id}-approve` ? "..." : "Approve"}
                      </button>
                      <button
                        onClick={() => handleQuickAction(b.id, "decline")}
                        disabled={!!actionInProgress}
                        className="flex-1 text-xs py-1.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors font-semibold uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionInProgress === `${b.id}-decline` ? "..." : "Decline"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming approved events */}
          <div>
            <h2 className="text-sm uppercase tracking-widest text-brand-text-muted font-semibold mb-4">
              Upcoming Events
            </h2>
            {upcomingBookings.length === 0 ? (
              <div className="v8-card p-6 text-center text-brand-text-muted text-sm">No upcoming events</div>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map((b) => (
                  <Link key={b.id} href={`/admin/bookings/${b.id}`} className="v8-card p-4 flex items-center justify-between hover:border-brand-red/40 transition-colors block">
                    <div>
                      <p className="font-semibold text-brand-text text-sm">{b.clients?.full_name}</p>
                      <p className="text-brand-text-muted text-xs">{b.event_date} at {b.event_time}</p>
                      <p className="text-brand-text-muted text-xs">{b.city}{b.state ? `, ${b.state}` : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-brand-text font-bold text-sm">{formatCurrency(b.remainder_amount ?? 0)}</p>
                      <p className="text-brand-text-muted text-xs">due on day</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
