"use client";
import { useState, useEffect, useCallback } from "react";
import type { BookingFormState } from "@/types/booking";
import DatePicker from "./DatePicker";
import AddressAutocomplete from "./AddressAutocomplete";

interface BookingSlot {
  date: string;
  startTime: string; // "HH:MM"
  durationHours: number;
}

interface AvailabilityData {
  bookings: BookingSlot[];
  travelBufferHours: number;
}

// Generate all 15-min time slots between 08:00 and 22:00
function generateSlots() {
  const slots: { value: string; label: string }[] = [];
  for (let mins = 8 * 60; mins <= 22 * 60; mins += 15) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const period = h < 12 ? "AM" : "PM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const label = `${h12}:${String(m).padStart(2, "0")} ${period}`;
    slots.push({ value, label });
  }
  return slots;
}

const ALL_SLOTS = generateSlots();

function toMins(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function isSlotBlocked(
  slotMins: number,
  durationMins: number,
  booking: BookingSlot,
  bufferMins: number
): boolean {
  const bStart = toMins(booking.startTime);
  const bEnd = bStart + booking.durationHours * 60;
  // User's session [slotMins, slotMins+durationMins] must not overlap
  // with the existing booking's buffered window [bStart-bufferMins, bEnd+bufferMins]
  return slotMins < bEnd + bufferMins && slotMins + durationMins > bStart - bufferMins;
}

interface Props {
  formState: BookingFormState;
  durationHours: number;
  onUpdate: (updates: Partial<BookingFormState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step3Details({ formState, durationHours, onUpdate, onNext, onBack }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const hasGenerator = formState.selectedAddons.some((a) => a.key === "generator");

  const fetchAvailability = useCallback(async () => {
    setAvailLoading(true);
    try {
      const res = await fetch("/api/bookings/availability");
      if (res.ok) setAvailability(await res.json());
    } finally {
      setAvailLoading(false);
    }
  }, []);

  // Fetch availability once on mount
  useEffect(() => { fetchAvailability(); }, [fetchAvailability]);

  // Re-clear selected time if it becomes blocked after a date change
  useEffect(() => {
    if (!formState.eventTime || !formState.eventDate || !availability) return;
    const slotMins = toMins(formState.eventTime);
    const durationMins = durationHours * 60;
    const bufferMins = availability.travelBufferHours * 60;
    const bookingsOnDate = availability.bookings.filter((b) => b.date === formState.eventDate);
    const blocked = bookingsOnDate.some((b) => isSlotBlocked(slotMins, durationMins, b, bufferMins));
    if (blocked) onUpdate({ eventTime: "" });
  }, [formState.eventDate, availability, durationHours]); // eslint-disable-line react-hooks/exhaustive-deps

  const getBlockedSlots = (): Set<string> => {
    if (!availability || !formState.eventDate) return new Set();
    const bookingsOnDate = availability.bookings.filter((b) => b.date === formState.eventDate);
    if (bookingsOnDate.length === 0) return new Set();
    const durationMins = durationHours * 60;
    const bufferMins = availability.travelBufferHours * 60;
    const blocked = new Set<string>();
    for (const slot of ALL_SLOTS) {
      const slotMins = toMins(slot.value);
      // Also block if event would run past 10pm
      if (slotMins + durationMins > 22 * 60) {
        blocked.add(slot.value);
        continue;
      }
      if (bookingsOnDate.some((b) => isSlotBlocked(slotMins, durationMins, b, bufferMins))) {
        blocked.add(slot.value);
      }
    }
    return blocked;
  };

  const blockedSlots = getBlockedSlots();
  // Late-night slots always blocked regardless of date (past 10pm - duration)
  const endOfDayBlockedSlots = new Set(
    ALL_SLOTS.filter((s) => toMins(s.value) + durationHours * 60 > 22 * 60).map((s) => s.value)
  );
  const allBlockedSlots = formState.eventDate
    ? blockedSlots
    : endOfDayBlockedSlots;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formState.eventDate) e.eventDate = "Event date is required";
    if (!formState.eventTime) e.eventTime = "Event time is required";
    if (!formState.fullName.trim()) e.fullName = "Name is required";
    if (!formState.email.trim() || !/\S+@\S+\.\S+/.test(formState.email)) e.email = "Valid email is required";
    if (!formState.phone.trim()) e.phone = "Phone number is required";
    else if (!/^\+?[\d\s\-().]{7,15}$/.test(formState.phone.trim())) e.phone = "Enter a valid phone number";
    if (!formState.address.trim()) e.address = "Address is required";
    if (!formState.city.trim()) e.city = "City is required";
    if (!formState.hasSpaceConfirmed) e.hasSpaceConfirmed = "Please confirm your venue has adequate space";
    if (!hasGenerator && !formState.hasPowerConfirmed) e.hasPowerConfirmed = "Please confirm power availability";
    return e;
  };

  const handleNext = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length === 0) onNext();
  };

  const field = (key: keyof BookingFormState) => ({
    value: formState[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onUpdate({ [key]: e.target.value }),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-brand-text mb-1">Event Details & Location</h2>
        <p className="text-brand-text-muted text-sm">Tell us about your event.</p>
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
            Event Date *
          </label>
          <DatePicker
            value={formState.eventDate}
            onChange={(date) => onUpdate({ eventDate: date, eventTime: "" })}
          />
          {errors.eventDate && <p className="text-red-400 text-xs mt-1">{errors.eventDate}</p>}
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
            Start Time *
          </label>
          <div className="bg-brand-dark-surface border border-brand-border-subtle rounded-md p-3 min-h-[50px]">
            {!formState.eventDate ? (
              <p className="text-brand-text-muted text-sm text-center py-2">Select a date first</p>
            ) : availLoading ? (
              <div className="flex items-center justify-center py-2 gap-2">
                <svg className="w-4 h-4 animate-spin text-brand-red" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-brand-text-muted text-xs">Checking availability…</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1 max-h-56 overflow-y-auto pr-1">
                {ALL_SLOTS.map((slot) => {
                  const blocked = allBlockedSlots.has(slot.value);
                  const selected = formState.eventTime === slot.value;
                  return (
                    <button
                      key={slot.value}
                      type="button"
                      disabled={blocked}
                      onClick={() => !blocked && onUpdate({ eventTime: slot.value })}
                      className={[
                        "text-xs rounded px-1 py-1.5 text-center transition-colors duration-150",
                        blocked
                          ? "opacity-25 cursor-not-allowed line-through text-brand-text-muted"
                          : selected
                          ? "bg-brand-red text-white font-semibold"
                          : "text-brand-text hover:bg-brand-red/20 hover:text-brand-text cursor-pointer",
                      ].join(" ")}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {errors.eventTime && <p className="text-red-400 text-xs mt-1">{errors.eventTime}</p>}
          {formState.eventDate && !availLoading && availability && (
            <p className="text-brand-text-muted text-xs mt-1">
              Grayed slots are unavailable or conflict with existing bookings
              {availability.travelBufferHours > 0 && ` (incl. ${availability.travelBufferHours}h travel buffer)`}.
            </p>
          )}
        </div>
      </div>

      {/* Client info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
            Full Name *
          </label>
          <input type="text" placeholder="John Smith" className="v8-input" {...field("fullName")} />
          {errors.fullName && <p className="text-red-400 text-xs mt-1">{errors.fullName}</p>}
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
            Email *
          </label>
          <input type="email" placeholder="you@example.com" className="v8-input" {...field("email")} />
          {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
            Phone *
          </label>
          <input type="tel" placeholder="(203) 555-0100" className="v8-input" {...field("phone")} />
          {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
            Street Address *
          </label>
          <AddressAutocomplete
            value={formState.address}
            onChange={(v) => onUpdate({ address: v })}
            onAddressSelect={({ address, city, state, zip }) =>
              onUpdate({ address, city, state, zip })
            }
          />
          {errors.address && <p className="text-red-400 text-xs mt-1">{errors.address}</p>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
              City *
            </label>
            <input type="text" placeholder="Hartford" className="v8-input" {...field("city")} />
            {errors.city && <p className="text-red-400 text-xs mt-1">{errors.city}</p>}
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
              State
            </label>
            <input type="text" placeholder="CT" maxLength={2} className="v8-input" {...field("state")} />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
              ZIP
            </label>
            <input type="text" placeholder="06101" className="v8-input" {...field("zip")} />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
          Additional Notes (optional)
        </label>
        <textarea
          rows={3}
          placeholder="Parking instructions, gate codes, special requests..."
          className="v8-input resize-none"
          value={formState.clientNotes}
          onChange={(e) => onUpdate({ clientNotes: e.target.value })}
        />
      </div>

      {/* Space Requirements Notice */}
      <div className="bg-brand-red/10 border border-brand-red/30 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-brand-red shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-brand-text font-semibold text-sm mb-1">Space Requirements</p>
            <p className="text-brand-text-muted text-sm leading-relaxed">
              Our simulator requires a minimum space of <strong className="text-brand-text">22ft × 12ft</strong> with a{" "}
              <strong className="text-brand-text">ceiling height of 10ft</strong>. Please ensure your venue meets these requirements.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation checkboxes */}
      <div className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 accent-brand-red w-4 h-4"
            checked={formState.hasSpaceConfirmed}
            onChange={(e) => onUpdate({ hasSpaceConfirmed: e.target.checked })}
          />
          <span className="text-sm text-brand-text">
            I confirm my venue has at least <strong>22ft × 12ft</strong> of clear space with <strong>10ft ceiling height</strong>
          </span>
        </label>
        {errors.hasSpaceConfirmed && <p className="text-red-400 text-xs ml-7">{errors.hasSpaceConfirmed}</p>}

        {!hasGenerator && (
          <>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 accent-brand-red w-4 h-4"
                checked={formState.hasPowerConfirmed}
                onChange={(e) => onUpdate({ hasPowerConfirmed: e.target.checked })}
              />
              <span className="text-sm text-brand-text">
                I confirm my venue has a standard power outlet available
              </span>
            </label>
            {errors.hasPowerConfirmed && <p className="text-red-400 text-xs ml-7">{errors.hasPowerConfirmed}</p>}
          </>
        )}

        {hasGenerator && (
          <div className="text-sm text-green-400 ml-7 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Power confirmed via Generator add-on
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button onClick={onBack} className="btn-v8 w-full sm:w-auto">← Back</button>
        <button onClick={handleNext} className="btn-v8-red w-full sm:w-auto">Continue to Payment →</button>
      </div>
    </div>
  );
}
