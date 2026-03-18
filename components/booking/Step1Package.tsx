"use client";
import { useState } from "react";
import type { SimPackage, SimPricingConfig, BookingFormState } from "@/types/booking";
import { formatCurrency, getPackagePrice } from "@/lib/pricing";

interface Props {
  packages: SimPackage[];
  config: SimPricingConfig;
  formState: BookingFormState;
  onUpdate: (updates: Partial<BookingFormState>) => void;
  onNext: () => void;
}

export default function Step1Package({ packages, config, formState, onUpdate, onNext }: Props) {
  const [customHours, setCustomHours] = useState(formState.customHours || 2);

  const handleSelectPackage = (pkg: SimPackage) => {
    onUpdate({ packageKey: pkg.key, customHours: pkg.hours });
  };

  const handleCustomSelect = () => {
    onUpdate({ packageKey: "custom", customHours });
  };

  const handleCustomHoursChange = (h: number) => {
    const clamped = Math.min(8, Math.max(1, h));
    setCustomHours(clamped);
    if (formState.packageKey === "custom") {
      onUpdate({ customHours: clamped });
    }
  };

  const customPrice = config.hourly_rate * customHours + config.setup_fee;
  const canContinue = formState.packageKey !== null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-brand-text mb-1">Choose Your Package</h2>
        <p className="text-brand-text-muted text-sm">Select a preset package or build your own custom experience.</p>
      </div>

      {/* Pricing basis note */}
      <div className="flex items-center gap-2 text-xs text-brand-text-muted bg-brand-dark-surface border border-brand-border-subtle rounded-md px-4 py-2.5">
        <svg className="w-4 h-4 text-brand-red shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Base rate: <span className="text-brand-text font-semibold">{formatCurrency(config.hourly_rate)}/hr</span> + {formatCurrency(config.setup_fee)} setup fee
      </div>

      {/* Preset packages */}
      <div className="grid gap-4">
        {packages.map((pkg) => {
          const isSelected = formState.packageKey === pkg.key;
          const price = getPackagePrice(pkg, config);
          const basePrice = config.hourly_rate * pkg.hours + config.setup_fee;
          const hasDiscount = (pkg.discount_percent ?? 0) > 0;

          return (
            <button
              key={pkg.key}
              onClick={() => handleSelectPackage(pkg)}
              className={`v8-selectable text-left w-full ${isSelected ? "selected" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-bold text-brand-text">{pkg.label}</span>
                    {pkg.key === "standard_2h" && (
                      <span className="text-xs bg-brand-red text-white px-2 py-0.5 rounded-full uppercase tracking-wide font-bold">
                        Popular
                      </span>
                    )}
                    {hasDiscount && (
                      <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-bold">
                        {pkg.discount_percent}% off
                      </span>
                    )}
                  </div>
                  <p className="text-brand-text-muted text-sm">{pkg.description}</p>
                  <p className="text-xs text-brand-text-muted mt-1">
                    {pkg.hours} hour{pkg.hours > 1 ? "s" : ""} · {formatCurrency(config.hourly_rate)}/hr
                    {hasDiscount && ` · ${pkg.discount_percent}% discount applied`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {hasDiscount && (
                    <p className="text-brand-text-muted text-sm line-through">{formatCurrency(basePrice)}</p>
                  )}
                  <span className="text-xl font-bold text-brand-text">{formatCurrency(price)}</span>
                </div>
              </div>
              {isSelected && (
                <div className="mt-3 flex items-center gap-2 text-brand-red text-xs font-semibold uppercase tracking-wide">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Selected
                </div>
              )}
            </button>
          );
        })}

        {/* Custom package */}
        <button
          onClick={handleCustomSelect}
          className={`v8-selectable text-left w-full ${formState.packageKey === "custom" ? "selected" : ""}`}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <span className="font-bold text-brand-text">Build Your Own</span>
              <p className="text-brand-text-muted text-sm mt-1">
                {formatCurrency(config.hourly_rate)}/hr + {formatCurrency(config.setup_fee)} setup fee · no discount
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xl font-bold text-brand-text">{formatCurrency(customPrice)}</span>
            </div>
          </div>

          {/* Hour stepper */}
          <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm text-brand-text-muted">Hours:</span>
            <div className="flex items-center gap-2 bg-brand-dark-surface border border-brand-border-subtle rounded-full px-2 py-1">
              <button
                type="button"
                onClick={() => handleCustomHoursChange(customHours - 1)}
                className="w-7 h-7 flex items-center justify-center text-brand-text hover:text-brand-red transition-colors rounded-full"
              >
                −
              </button>
              <span className="w-8 text-center text-brand-text font-bold">{customHours}</span>
              <button
                type="button"
                onClick={() => handleCustomHoursChange(customHours + 1)}
                className="w-7 h-7 flex items-center justify-center text-brand-text hover:text-brand-red transition-colors rounded-full"
              >
                +
              </button>
            </div>
            <span className="text-xs text-brand-text-muted">(max 8)</span>
          </div>

          {formState.packageKey === "custom" && (
            <div className="mt-3 flex items-center gap-2 text-brand-red text-xs font-semibold uppercase tracking-wide">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Selected
            </div>
          )}
        </button>
      </div>

      <div className="pt-2">
        <button
          onClick={onNext}
          disabled={!canContinue}
          className="btn-v8-red w-full sm:w-auto disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue to Add-ons →
        </button>
      </div>
    </div>
  );
}
