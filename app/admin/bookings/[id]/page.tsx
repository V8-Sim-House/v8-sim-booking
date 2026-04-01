"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/admin/AdminNav";
import StatusBadge from "@/components/admin/StatusBadge";
import { formatCurrency } from "@/lib/pricing";
import { toast } from "sonner";
import type { SimBooking, BookingStatus } from "@/types/booking";

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  useRouter();
  const [booking, setBooking] = useState<SimBooking | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("sim_bookings")
      .select("*, clients(*), sim_booking_addons(*)")
      .eq("id", id)
      .single();
    if (data) {
      setBooking(data as SimBooking);
      setAdminNotes(data.admin_notes ?? "");
    }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  const doAction = async (action: string) => {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/bookings/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Booking ${action}d successfully`);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const saveNotes = async () => {
    await supabase.from("sim_bookings").update({ admin_notes: adminNotes }).eq("id", id);
    toast.success("Notes saved");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-black">
        <AdminNav />
        <div className="flex items-center justify-center py-40 text-brand-text-muted">Loading...</div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-brand-black">
        <AdminNav />
        <div className="text-center py-20">
          <p className="text-brand-text-muted">Booking not found.</p>
          <Link href="/admin/bookings" className="btn-v8-red mt-4 inline-block">Back to Bookings</Link>
        </div>
      </div>
    );
  }

  const status = booking.status as BookingStatus;
  const isReadOnly = status === "cancelled" || status === "completed";

  return (
    <div className="min-h-screen bg-brand-black">
      <AdminNav />
      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <Link href="/admin/bookings" className="text-brand-text-muted text-xs uppercase tracking-widest hover:text-brand-text transition-colors">
              ← Back to Bookings
            </Link>
            <h1 className="text-2xl font-bold text-brand-text mt-2">
              Booking #{id.slice(0, 8).toUpperCase()}
            </h1>
            <p className="text-brand-text-muted text-sm mt-1">
              Submitted {new Date(booking.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} at {new Date(booking.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Client info */}
            <div className="v8-card p-6">
              <h2 className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-4">Client</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-brand-text-muted text-xs mb-1">Name</p>
                  <p className="text-brand-text font-semibold">{booking.clients?.full_name}</p>
                </div>
                <div>
                  <p className="text-brand-text-muted text-xs mb-1">Email</p>
                  <a href={`mailto:${booking.clients?.email}`} className="text-brand-red hover:underline">{booking.clients?.email}</a>
                </div>
                <div>
                  <p className="text-brand-text-muted text-xs mb-1">Phone</p>
                  <p className="text-brand-text">{booking.clients?.phone ?? "—"}</p>
                </div>
              </div>
            </div>

            {/* Event info */}
            <div className="v8-card p-6">
              <h2 className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-4">Event Details</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-brand-text-muted text-xs mb-1">Date</p>
                  <p className="text-brand-text font-semibold">{booking.event_date}</p>
                </div>
                <div>
                  <p className="text-brand-text-muted text-xs mb-1">Time</p>
                  <p className="text-brand-text font-semibold">{booking.event_time}</p>
                </div>
                <div>
                  <p className="text-brand-text-muted text-xs mb-1">Package</p>
                  <p className="text-brand-text font-semibold capitalize">{booking.package_type?.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <p className="text-brand-text-muted text-xs mb-1">Duration</p>
                  <p className="text-brand-text">{booking.duration_hours}h</p>
                </div>
                <div className="col-span-2">
                  <p className="text-brand-text-muted text-xs mb-1">Address</p>
                  <p className="text-brand-text">
                    {booking.client_address}, {booking.city}{booking.state ? `, ${booking.state}` : ""} {booking.zip ?? ""}
                  </p>
                </div>
                {booking.event_type && (
                  <div>
                    <p className="text-brand-text-muted text-xs mb-1">Event Type</p>
                    <p className="text-brand-text font-semibold capitalize">{booking.event_type}</p>
                  </div>
                )}
                {booking.expected_guests != null && (
                  <div>
                    <p className="text-brand-text-muted text-xs mb-1">Expected Guests</p>
                    <p className="text-brand-text font-semibold">{booking.expected_guests}</p>
                  </div>
                )}
                <div>
                  <p className="text-brand-text-muted text-xs mb-1">Space Confirmed</p>
                  <p className={booking.has_space_confirmed ? "text-green-400" : "text-red-400"}>
                    {booking.has_space_confirmed ? "✓ Yes" : "✗ No"}
                  </p>
                </div>
                <div>
                  <p className="text-brand-text-muted text-xs mb-1">Power Confirmed</p>
                  <p className={booking.has_power_confirmed ? "text-green-400" : "text-red-400"}>
                    {booking.has_power_confirmed ? "✓ Yes" : "✗ No"}
                  </p>
                </div>
              </div>
              {booking.client_notes && (
                <div className="mt-4 pt-4 border-t border-brand-border-subtle">
                  <p className="text-brand-text-muted text-xs mb-1">Client Notes</p>
                  <p className="text-brand-text text-sm">{booking.client_notes}</p>
                </div>
              )}
            </div>

            {/* Add-ons */}
            {booking.sim_booking_addons && booking.sim_booking_addons.length > 0 && (
              <div className="v8-card p-6">
                <h2 className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-4">Add-ons</h2>
                <div className="space-y-2">
                  {booking.sim_booking_addons.map((a) => (
                    <div key={a.id} className="flex justify-between text-sm">
                      <span className="text-brand-text">{a.addon_label}</span>
                      <span className="text-brand-text-muted">{formatCurrency(a.addon_price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin notes */}
            <div className="v8-card p-6">
              <h2 className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-4">Admin Notes</h2>
              <textarea
                rows={4}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                onBlur={saveNotes}
                placeholder="Add internal notes here..."
                className="v8-input resize-none text-sm"
              />
              <p className="text-xs text-brand-text-muted mt-1">Auto-saves on blur</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pricing */}
            <div className="v8-card p-5">
              <h2 className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-4">Pricing</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-brand-text-muted">Subtotal</span>
                  <span className="text-brand-text">{formatCurrency(booking.subtotal ?? 0)}</span>
                </div>
                {(booking.addons_total ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-brand-text-muted">Add-ons</span>
                    <span className="text-brand-text">{formatCurrency(booking.addons_total ?? 0)}</span>
                  </div>
                )}
                <div className="border-t border-brand-border-subtle pt-2">
                  <div className="flex justify-between">
                    <span className="text-brand-text-muted">Deposit</span>
                    <span className={booking.deposit_captured_at ? "text-green-400 font-semibold" : "text-brand-red font-semibold"}>
                      {formatCurrency(booking.deposit_amount ?? 0)}
                      {booking.deposit_captured_at && " ✓"}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-brand-text-muted">Remainder</span>
                    <span className={booking.remainder_captured_at ? "text-green-400 font-semibold" : "text-brand-text"}>
                      {formatCurrency(booking.remainder_amount ?? 0)}
                      {booking.remainder_captured_at && " ✓"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Damage deposit notice */}
            <div className="flex gap-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-xs text-blue-200 leading-relaxed">
              <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>
                <strong className="text-blue-100">Damage Deposit:</strong> A refundable $300 deposit is collected on arrival (cash, card, or Zelle) prior to setup. Returned in full if no damage occurred.
              </p>
            </div>

            {/* Stripe */}
            <div className="v8-card p-5">
              <h2 className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-4">Stripe</h2>
              <div className="space-y-2 text-xs">
                <div>
                  <p className="text-brand-text-muted mb-1">Deposit Intent</p>
                  <p className="text-brand-text font-mono break-all">{booking.stripe_payment_intent_id ?? "—"}</p>
                </div>
                {booking.stripe_remainder_intent_id && (
                  <div>
                    <p className="text-brand-text-muted mb-1">Remainder Intent</p>
                    <p className="text-brand-text font-mono break-all">{booking.stripe_remainder_intent_id}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {!isReadOnly && (
              <div className="v8-card p-5">
                <h2 className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-4">Actions</h2>
                <div className="space-y-3">
                  {status === "pending" && (
                    <>
                      <button
                        onClick={() => doAction("approve")}
                        disabled={actionLoading !== null}
                        className="w-full py-2.5 rounded-md bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors font-semibold uppercase tracking-wide text-xs disabled:opacity-50"
                      >
                        {actionLoading === "approve" ? "Processing..." : "✓ Approve & Capture Deposit"}
                      </button>
                      <button
                        onClick={() => doAction("decline")}
                        disabled={actionLoading !== null}
                        className="w-full py-2.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors font-semibold uppercase tracking-wide text-xs disabled:opacity-50"
                      >
                        {actionLoading === "decline" ? "Processing..." : "✗ Decline & Release Hold"}
                      </button>
                    </>
                  )}
                  {status === "approved" && (
                    <>
                      <button
                        onClick={() => doAction("charge-remainder")}
                        disabled={actionLoading !== null}
                        className="w-full py-2.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors font-semibold uppercase tracking-wide text-xs disabled:opacity-50"
                      >
                        {actionLoading === "charge-remainder" ? "Processing..." : "💳 Charge Remainder"}
                      </button>
                      <button
                        onClick={() => doAction("cancel")}
                        disabled={actionLoading !== null}
                        className="w-full py-2.5 rounded-md bg-gray-500/20 text-gray-400 border border-gray-500/30 hover:bg-gray-500/30 transition-colors font-semibold uppercase tracking-wide text-xs disabled:opacity-50"
                      >
                        {actionLoading === "cancel" ? "Processing..." : "Cancel Booking"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
