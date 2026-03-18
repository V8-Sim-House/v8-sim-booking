"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { formatCurrency } from "@/lib/pricing";
import type { SimBooking } from "@/types/booking";

export default function SuccessContent() {
  const params = useSearchParams();
  const bookingId = params.get("id");
  const [booking, setBooking] = useState<SimBooking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) { setLoading(false); return; }
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        setBooking(data);
        setLoading(false);
      });
  }, [bookingId]);

  const ref = bookingId?.slice(0, 8).toUpperCase() ?? "—";

  return (
    <div className="min-h-screen bg-brand-black flex flex-col">
      <Navbar />

      <main className="flex-1 pt-28 pb-16">
        <div className="max-w-2xl mx-auto px-6">
          {loading ? (
            <div className="text-center py-20 text-brand-text-muted">Loading...</div>
          ) : !booking ? (
            <div className="text-center py-20">
              <p className="text-brand-text-muted mb-4">Booking not found.</p>
              <Link href="/book" className="btn-v8-red">Start a New Booking</Link>
            </div>
          ) : (
            <div className="animate-slide-up">
              {/* Success header */}
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-brand-text mb-2">Request Received!</h1>
                <p className="text-brand-text-muted">
                  We&apos;ve received your booking request and will review it shortly.
                </p>
              </div>

              {/* Booking ref */}
              <div className="v8-card p-6 mb-6">
                <div className="text-center mb-6">
                  <p className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-1">Booking Reference</p>
                  <p className="text-3xl font-bold text-brand-red">#{ref}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-brand-text-muted text-xs uppercase tracking-wide mb-1">Event Date</p>
                    <p className="text-brand-text font-semibold">{booking.event_date}</p>
                  </div>
                  <div>
                    <p className="text-brand-text-muted text-xs uppercase tracking-wide mb-1">Start Time</p>
                    <p className="text-brand-text font-semibold">{booking.event_time}</p>
                  </div>
                  <div>
                    <p className="text-brand-text-muted text-xs uppercase tracking-wide mb-1">Package</p>
                    <p className="text-brand-text font-semibold">{booking.package_type?.replace(/_/g, " ")}</p>
                  </div>
                  <div>
                    <p className="text-brand-text-muted text-xs uppercase tracking-wide mb-1">Total</p>
                    <p className="text-brand-text font-semibold">{formatCurrency(booking.subtotal ?? 0)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-brand-text-muted text-xs uppercase tracking-wide mb-1">Location</p>
                    <p className="text-brand-text font-semibold">
                      {booking.client_address}, {booking.city}{booking.state ? `, ${booking.state}` : ""}
                    </p>
                  </div>
                </div>

                <div className="border-t border-brand-border-subtle mt-4 pt-4 flex justify-between text-sm">
                  <span className="text-brand-text-muted">Deposit held on card</span>
                  <span className="text-brand-red font-bold">{formatCurrency(booking.deposit_amount ?? 0)}</span>
                </div>
              </div>

              {/* What happens next */}
              <div className="v8-card p-6 mb-8">
                <h2 className="font-bold text-brand-text mb-4">What happens next?</h2>
                <div className="space-y-4">
                  {[
                    {
                      icon: "📋",
                      title: "We review your request",
                      desc: "Our team will review your booking details within 24–48 hours.",
                    },
                    {
                      icon: "💳",
                      title: "Deposit is captured on approval",
                      desc: `Once approved, your deposit of ${formatCurrency(booking.deposit_amount ?? 0)} will be charged to your card.`,
                    },
                    {
                      icon: "📧",
                      title: "You'll receive a confirmation email",
                      desc: "Check your inbox — we'll send full confirmation details to your email address.",
                    },
                    {
                      icon: "🏎️",
                      title: "Enjoy the event!",
                      desc: `The remaining balance of ${formatCurrency(booking.remainder_amount ?? 0)} will be collected on the day of your event.`,
                    },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-2xl">{item.icon}</span>
                      <div>
                        <p className="font-semibold text-brand-text text-sm">{item.title}</p>
                        <p className="text-brand-text-muted text-sm">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-center">
                <Link href="/" className="btn-v8 inline-block">
                  Back to Home
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
