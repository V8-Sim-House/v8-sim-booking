"use client";
import type { SimAddon, SimPackage, BookingFormState, SimPricingConfig } from "@/types/booking";
import { formatCurrency } from "@/lib/pricing";

interface Props {
  addons: SimAddon[];
  packages: SimPackage[];
  config: SimPricingConfig;
  formState: BookingFormState;
  onUpdate: (updates: Partial<BookingFormState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step2Addons({ addons, formState, onUpdate, onNext, onBack }: Props) {
  // Determine hours for the current selection (for per-hour price display)
  const selectedPkg = formState.packageKey;
  const hours = selectedPkg === "custom" ? formState.customHours : (
    selectedPkg === "standard_1h" ? 1 :
    selectedPkg === "standard_2h" ? 2 :
    selectedPkg === "standard_3h" ? 3 : formState.customHours
  );

  const toggle = (addon: SimAddon) => {
    const exists = formState.selectedAddons.some((a) => a.key === addon.key);
    if (exists) {
      onUpdate({ selectedAddons: formState.selectedAddons.filter((a) => a.key !== addon.key) });
    } else {
      onUpdate({ selectedAddons: [...formState.selectedAddons, addon] });
    }
  };

  const isSelected = (key: string) => formState.selectedAddons.some((a) => a.key === key);

  const addonTotalPrice = (addon: SimAddon) =>
    addon.is_per_hour ? addon.price * hours : addon.price;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-brand-text mb-1">Add-ons & Extras</h2>
        <p className="text-brand-text-muted text-sm">Enhance your experience with optional extras.</p>
      </div>

      {addons.length === 0 ? (
        <p className="text-brand-text-muted">No add-ons currently available.</p>
      ) : (
        <div className="grid gap-4">
          {addons.map((addon) => {
            const selected = isSelected(addon.key);
            const total = addonTotalPrice(addon);

            return (
              <button
                key={addon.key}
                onClick={() => toggle(addon)}
                className={`v8-selectable text-left w-full ${selected ? "selected" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        selected ? "bg-brand-red border-brand-red" : "border-brand-border-subtle"
                      }`}
                    >
                      {selected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-brand-text">{addon.label}</div>
                      <p className="text-brand-text-muted text-sm mt-0.5">{addon.description}</p>
                      {addon.is_per_hour && (
                        <p className="text-xs text-brand-text-muted mt-1">
                          {formatCurrency(addon.price)}/hr × {hours}h
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-brand-text font-bold">+{formatCurrency(total)}</span>
                    {addon.is_per_hour && (
                      <p className="text-xs text-brand-text-muted">{formatCurrency(addon.price)}/hr</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button onClick={onBack} className="btn-v8 w-full sm:w-auto">← Back</button>
        <button onClick={onNext} className="btn-v8-red w-full sm:w-auto">Continue to Details →</button>
      </div>
    </div>
  );
}
