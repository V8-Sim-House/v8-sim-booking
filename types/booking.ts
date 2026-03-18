export type BookingStatus =
  | "pending"
  | "approved"
  | "declined"
  | "cancelled"
  | "completed";

export type PackageType =
  | "standard_1h"
  | "standard_2h"
  | "standard_3h"
  | "custom";

export interface Client {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

export interface SimBooking {
  id: string;
  client_id: string;
  status: BookingStatus;
  event_date: string;
  event_time: string;
  duration_hours: number;
  package_type: PackageType;
  hourly_rate: number | null;
  setup_fee: number | null;
  addons_total: number | null;
  subtotal: number | null;
  deposit_amount: number | null;
  remainder_amount: number | null;
  client_address: string;
  city: string;
  state: string | null;
  zip: string | null;
  has_space_confirmed: boolean;
  has_power_confirmed: boolean;
  client_notes: string | null;
  admin_notes: string | null;
  stripe_payment_intent_id: string | null;
  stripe_remainder_intent_id: string | null;
  deposit_captured_at: string | null;
  remainder_captured_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  clients?: Client;
  sim_booking_addons?: SimBookingAddon[];
}

export interface SimBookingAddon {
  id: string;
  booking_id: string;
  addon_key: string;
  addon_label: string;
  addon_price: number;
}

export interface SimPackage {
  id: string;
  key: PackageType;
  label: string;
  hours: number;
  discount_percent: number;  // discount off hourly_rate × hours
  description: string | null;
  is_active: boolean;
  display_order: number;
}

export interface SimAddon {
  id: string;
  key: string;
  label: string;
  description: string | null;
  price: number;           // per-hour rate if is_per_hour, else flat fee
  is_per_hour: boolean;
  is_active: boolean;
}

export interface SimPricingConfig {
  id: string;
  hourly_rate: number;
  setup_fee: number;
  deposit_percent: number;
  updated_at: string;
}

// Booking form state
export interface BookingFormState {
  // Step 1
  packageKey: PackageType | null;
  customHours: number;
  // Step 2
  selectedAddons: SimAddon[];
  // Step 3
  eventDate: string;
  eventTime: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  clientNotes: string;
  hasSpaceConfirmed: boolean;
  hasPowerConfirmed: boolean;
}

export interface PricingBreakdown {
  packageLabel: string;
  packagePrice: number;
  addonsTotal: number;
  subtotal: number;
  depositAmount: number;
  remainderAmount: number;
  depositPercent: number;
}
