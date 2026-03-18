"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/admin/AdminNav";
import StatusBadge from "@/components/admin/StatusBadge";
import { formatCurrency } from "@/lib/pricing";
import type { SimBooking, BookingStatus } from "@/types/booking";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

export default function BookingsPage() {
  const [bookings, setBookings] = useState<SimBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    async function load() {
      let query = supabase
        .from("sim_bookings")
        .select("*, clients(*)")
        .order("created_at", { ascending: false });

      if (statusFilter) query = query.eq("status", statusFilter);
      if (dateFrom) query = query.gte("event_date", dateFrom);
      if (dateTo) query = query.lte("event_date", dateTo);

      const { data } = await query;
      setBookings((data ?? []) as SimBooking[]);
      setLoading(false);
    }
    load();
  }, [statusFilter, dateFrom, dateTo]);

  const filtered = bookings.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.clients?.full_name.toLowerCase().includes(q) ||
      b.clients?.email.toLowerCase().includes(q) ||
      b.id.slice(0, 8).toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-brand-black">
      <AdminNav />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-brand-text">All Bookings</h1>
          <span className="text-brand-text-muted text-sm">{filtered.length} results</span>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <input
            type="text"
            placeholder="Search by name, email, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="v8-input text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="v8-input text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} style={{ background: "#111" }}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From date"
            className="v8-input text-sm"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To date"
            className="v8-input text-sm"
          />
        </div>

        {/* Table */}
        <div className="v8-card overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-brand-text-muted">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-brand-text-muted">No bookings found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-border-subtle">
                    {["Ref", "Client", "Date", "Package", "Total", "Deposit", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-widest text-brand-text-muted font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr key={b.id} className="border-b border-brand-border-subtle hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-mono text-brand-text-muted text-xs">
                        #{b.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-brand-text font-medium">{b.clients?.full_name}</p>
                        <p className="text-brand-text-muted text-xs">{b.clients?.email}</p>
                      </td>
                      <td className="px-4 py-3 text-brand-text">{b.event_date}</td>
                      <td className="px-4 py-3 text-brand-text-muted capitalize">
                        {b.package_type?.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-brand-text font-semibold">
                        {formatCurrency(b.subtotal ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-brand-red font-semibold">
                        {formatCurrency(b.deposit_amount ?? 0)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.status as BookingStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/bookings/${b.id}`}
                          className="text-brand-red text-xs hover:underline whitespace-nowrap"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
