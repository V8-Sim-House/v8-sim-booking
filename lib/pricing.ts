import type { SimPackage, SimAddon, SimPricingConfig, PricingBreakdown } from "@/types/booking";

export function calculatePricing(
  pkg: SimPackage | null,
  customHours: number,
  selectedAddons: SimAddon[],
  config: SimPricingConfig
): PricingBreakdown {
  // Determine hours for the booking
  const hours = pkg && pkg.key !== "custom" ? pkg.hours : customHours;

  // Addons: per-hour addons multiply by hours, flat addons stay flat
  const addonsTotal = selectedAddons.reduce(
    (sum, a) => sum + (a.is_per_hour ? a.price * hours : a.price),
    0
  );

  let packageLabel = "";
  let packagePrice = 0;

  if (pkg && pkg.key !== "custom") {
    const basePrice = config.hourly_rate * pkg.hours;
    const discountAmount = basePrice * ((pkg.discount_percent ?? 0) / 100);
    packagePrice = basePrice - discountAmount + config.setup_fee;
    packageLabel = pkg.label;
  } else {
    // Custom: no discount
    packagePrice = config.hourly_rate * customHours + config.setup_fee;
    packageLabel = `Custom (${customHours}h)`;
  }

  const subtotal = packagePrice + addonsTotal;
  const depositAmount = Math.round((subtotal * config.deposit_percent) / 100 * 100) / 100;
  const remainderAmount = Math.round((subtotal - depositAmount) * 100) / 100;

  return {
    packageLabel,
    packagePrice,
    addonsTotal,
    subtotal,
    depositAmount,
    remainderAmount,
    depositPercent: config.deposit_percent,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// Returns the effective price for a package given the current config
export function getPackagePrice(pkg: SimPackage, config: SimPricingConfig): number {
  const base = config.hourly_rate * pkg.hours;
  const discounted = base * (1 - (pkg.discount_percent ?? 0) / 100);
  return discounted + config.setup_fee;
}
