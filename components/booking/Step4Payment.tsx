"use client";
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type { BookingFormState, SimPackage, PricingBreakdown } from "@/types/booking";
import { formatCurrency } from "@/lib/pricing";
import { toast } from "sonner";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CheckoutFormProps {
  formState: BookingFormState;
  pricing: PricingBreakdown;
  selectedPackage: SimPackage | null;
  onBack: () => void;
  onSuccess: (bookingId: string) => void;
}

function CheckoutForm({ formState, pricing, onBack, onSuccess }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    try {
      // 1. Create booking + payment intent on server
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formState, pricing }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create booking");

      const { clientSecret, bookingId } = data;

      // 2. Confirm card (authorize/hold — not charge)
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error("Card element not found");

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: { name: formState.fullName, email: formState.email },
        },
      });

      if (error) throw new Error(error.message);
      if (paymentIntent?.status !== "requires_capture") {
        throw new Error("Payment authorization failed. Please try again.");
      }

      onSuccess(bookingId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-brand-text mb-1">Review & Payment</h2>
        <p className="text-brand-text-muted text-sm">Review your order and authorize your deposit.</p>
      </div>

      {/* Order Summary */}
      <div className="v8-card p-5 space-y-3">
        <h3 className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold">Order Summary</h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-brand-text-muted">Package</span>
            <span className="text-brand-text font-medium">{pricing.packageLabel}</span>
          </div>
          {formState.selectedAddons.map((a) => (
            <div key={a.key} className="flex justify-between">
              <span className="text-brand-text-muted">{a.label}</span>
              <span className="text-brand-text">+{formatCurrency(a.price)}</span>
            </div>
          ))}
          <div className="border-t border-brand-border-subtle pt-2 flex justify-between font-bold">
            <span className="text-brand-text">Total</span>
            <span className="text-brand-text">{formatCurrency(pricing.subtotal)}</span>
          </div>
        </div>

        <div className="border-t border-brand-border-subtle pt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-brand-text-muted">Date</span>
            <span className="text-brand-text">{formState.eventDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-text-muted">Time</span>
            <span className="text-brand-text">{formState.eventTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-text-muted">Address</span>
            <span className="text-brand-text text-right max-w-[180px]">
              {formState.address}, {formState.city}{formState.state ? `, ${formState.state}` : ""}
            </span>
          </div>
        </div>

        <div className="border-t border-brand-border-subtle pt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-brand-text-muted">Deposit ({pricing.depositPercent}%) — authorized now</span>
            <span className="text-brand-red font-bold">{formatCurrency(pricing.depositAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-brand-text-muted">Remainder — charged on event day</span>
            <span className="text-brand-text">{formatCurrency(pricing.remainderAmount)}</span>
          </div>
        </div>
      </div>

      {/* Card input */}
      <div className="v8-card p-5">
        <h3 className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-4">
          Card Details
        </h3>
        <div className="bg-brand-dark-surface border border-brand-border-subtle rounded-md p-4">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: "#dddddd",
                  fontFamily: "Raleway, sans-serif",
                  "::placeholder": { color: "#888888" },
                  iconColor: "#d32027",
                },
                invalid: { color: "#ef4444", iconColor: "#ef4444" },
              },
            }}
          />
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-brand-dark-surface border border-brand-border-subtle rounded-lg p-4 text-xs text-brand-text-muted leading-relaxed">
        Your card will be <strong className="text-brand-text">authorized for the deposit amount ({formatCurrency(pricing.depositAmount)})</strong> but{" "}
        <strong className="text-brand-text">not charged</strong> until we confirm your booking. The remaining balance ({formatCurrency(pricing.remainderAmount)}) will be automatically collected on the day of your event.{" "}
        <strong className="text-brand-text">Deposits are non-refundable.</strong>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button type="button" onClick={onBack} className="btn-v8 w-full sm:w-auto" disabled={submitting}>
          ← Back
        </button>
        <button
          type="submit"
          disabled={submitting || !stripe}
          className="btn-v8-red w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </>
          ) : (
            `Request Booking & Authorize ${formatCurrency(pricing.depositAmount)}`
          )}
        </button>
      </div>
    </form>
  );
}

interface Props {
  formState: BookingFormState;
  pricing: PricingBreakdown;
  selectedPackage: SimPackage | null;
  onBack: () => void;
  onSuccess: (bookingId: string) => void;
}

export default function Step4Payment(props: Props) {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm {...props} />
    </Elements>
  );
}
