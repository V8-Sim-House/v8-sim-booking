import { formatCurrency } from "@/lib/pricing";
import type { PricingBreakdown } from "@/types/booking";

interface Props {
  pricing: PricingBreakdown | null;
  step: number;
}

export default function PriceSummary({ pricing, step }: Props) {
  if (!pricing) {
    return (
      <div className="v8-card p-5 text-center">
        <p className="text-brand-text-muted text-sm">Select a package to see pricing</p>
      </div>
    );
  }

  return (
    <div className="v8-card p-5 space-y-3">
      <h3 className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-4">
        Price Summary
      </h3>

      <div className="flex justify-between text-sm">
        <span className="text-brand-text-muted">{pricing.packageLabel}</span>
        <span className="text-brand-text">{formatCurrency(pricing.packagePrice)}</span>
      </div>

      {pricing.addonsTotal > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-brand-text-muted">Add-ons</span>
          <span className="text-brand-text">{formatCurrency(pricing.addonsTotal)}</span>
        </div>
      )}

      <div className="border-t border-brand-border-subtle pt-3">
        <div className="flex justify-between">
          <span className="text-brand-text font-semibold">Total</span>
          <span className="text-brand-text font-bold text-lg">{formatCurrency(pricing.subtotal)}</span>
        </div>
      </div>

      {step >= 3 && (
        <>
          <div className="border-t border-brand-border-subtle pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-brand-text-muted">Deposit ({pricing.depositPercent}%) — due now</span>
              <span className="text-brand-red font-semibold">{formatCurrency(pricing.depositAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-brand-text-muted">Remainder — due on event day</span>
              <span className="text-brand-text">{formatCurrency(pricing.remainderAmount)}</span>
            </div>
          </div>
          <p className="text-xs text-brand-text-muted pt-2 leading-relaxed">
            Card will be <strong className="text-brand-text">authorized but not charged</strong> until booking is confirmed.
          </p>
        </>
      )}
    </div>
  );
}
