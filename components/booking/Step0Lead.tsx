"use client";
import { useState } from "react";
import { toast } from "sonner";
import { format, parseISO, addDays, isBefore, startOfDay } from "date-fns";
import DatePicker from "./DatePicker";

// ── Availability helpers (same logic as Step3Details) ─────────────────────────

interface BookingSlot {
  date: string;
  startTime: string;
  durationHours: number;
}

interface AvailabilityData {
  bookings: BookingSlot[];
  travelBufferHours: number;
}

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
  return slotMins < bEnd + bufferMins && slotMins + durationMins > bStart - bufferMins;
}

// For step 0 we don't know the package yet — use 1h as minimum check duration
const CHECK_DURATION_MINS = 120;

function getBlockedSlotsForDate(date: string, availability: AvailabilityData): Set<string> {
  const bookingsOnDate = availability.bookings.filter((b) => b.date === date);
  const bufferMins = availability.travelBufferHours * 60;
  const blocked = new Set<string>();
  for (const slot of ALL_SLOTS) {
    const slotMins = toMins(slot.value);
    if (bookingsOnDate.some((b) => isSlotBlocked(slotMins, CHECK_DURATION_MINS, b, bufferMins))) {
      blocked.add(slot.value);
    }
  }
  return blocked;
}

function findAlternativeDates(targetDate: string, bookedDates: Set<string>, count = 3): string[] {
  const today = startOfDay(new Date());
  const target = parseISO(targetDate);
  const candidates: string[] = [];
  for (let offset = 1; offset <= 90 && candidates.length < count * 3; offset++) {
    const fwd = addDays(target, offset);
    const bwd = addDays(target, -offset);
    const fwdStr = format(fwd, "yyyy-MM-dd");
    const bwdStr = format(bwd, "yyyy-MM-dd");
    if (!isBefore(fwd, today) && !bookedDates.has(fwdStr)) candidates.push(fwdStr);
    if (!isBefore(bwd, today) && !bookedDates.has(bwdStr)) candidates.push(bwdStr);
  }
  // Sort chronologically, take nearest 3
  return candidates
    .map((d) => ({ d, dist: Math.abs(parseISO(d).getTime() - target.getTime()) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, count)
    .map((x) => x.d)
    .sort();
}

function formatDisplayDate(dateStr: string) {
  return format(parseISO(dateStr), "EEEE, MMMM d");
}

function formatShortDate(dateStr: string) {
  return format(parseISO(dateStr), "EEE, MMM d");
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPE_OPTIONS = [
  "Birthday Party",
  "Corporate Event",
  "Graduation",
  "Wedding",
  "Other",
];

// ── Component ─────────────────────────────────────────────────────────────────

export type LeadAvailStatus = "available" | "unavailable" | null;

interface InitialData {
  fullName?: string;
  email?: string;
  eventType?: string;
  eventDate?: string;
  eventTime?: string;
}

interface Props {
  initialData?: InitialData;
  onComplete: (leadId: string, data: {
    fullName: string;
    email: string;
    eventType: string;
    eventDate: string;
    eventTime: string;
    availStatus: LeadAvailStatus;
    altDates: string[];
  }) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(fields: {
  fullName: string;
  email: string;
  eventTypeSelect: string;
  otherEventType: string;
  eventDate: string;
  eventTime: string;
}) {
  const errs: Partial<Record<"fullName" | "email" | "eventType" | "eventDate" | "eventTime", string>> = {};
  if (!fields.fullName.trim()) errs.fullName = "Full name is required.";
  else if (fields.fullName.trim().length < 2) errs.fullName = "Please enter your full name.";
  if (!fields.email.trim()) errs.email = "Email address is required.";
  else if (!EMAIL_RE.test(fields.email.trim())) errs.email = "Please enter a valid email address.";
  if (!fields.eventTypeSelect) errs.eventType = "Please select an event type.";
  else if (fields.eventTypeSelect === "Other" && !fields.otherEventType.trim()) errs.eventType = "Please describe your event.";
  if (!fields.eventDate) errs.eventDate = "Please select a date.";
  if (!fields.eventTime) errs.eventTime = "Please select a start time.";
  return errs;
}

export default function Step0Lead({ initialData, onComplete }: Props) {
  const [fullName, setFullName] = useState(initialData?.fullName ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [eventTypeSelect, setEventTypeSelect] = useState(() => {
    const et = initialData?.eventType ?? "";
    return et && !EVENT_TYPE_OPTIONS.includes(et) ? "Other" : et;
  });
  const [otherEventType, setOtherEventType] = useState(() => {
    const et = initialData?.eventType ?? "";
    return et && !EVENT_TYPE_OPTIONS.includes(et) ? et : "";
  });
  const [eventDate, setEventDate] = useState(initialData?.eventDate ?? "");
  const [eventTime, setEventTime] = useState(initialData?.eventTime ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<"fullName" | "email" | "eventType" | "eventDate" | "eventTime", boolean>>>(() => {
    // Pre-touch fields that were already filled (returning user)
    const t: Partial<Record<"fullName" | "email" | "eventType" | "eventDate" | "eventTime", boolean>> = {};
    if (initialData?.fullName) t.fullName = true;
    if (initialData?.email) t.email = true;
    if (initialData?.eventType) t.eventType = true;
    if (initialData?.eventDate) t.eventDate = true;
    if (initialData?.eventTime) t.eventTime = true;
    return t;
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const errors = validate({ fullName, email, eventTypeSelect, otherEventType, eventDate, eventTime });
  const isValid = Object.keys(errors).length === 0;

  const fieldError = (key: keyof typeof errors) =>
    (touched[key] || submitAttempted) ? errors[key] : undefined;

  const touch = (key: keyof typeof errors) =>
    setTouched((t) => ({ ...t, [key]: true }));

  // No slots grayed out in the grid — conflicts are shown via the banner on Step 1.
  const allBlockedSlots = new Set<string>();

  const resolvedEventType = eventTypeSelect === "Other" ? otherEventType.trim() : eventTypeSelect;
  const canSubmit = isValid;

  const handleDateChange = (date: string) => {
    setEventDate(date);
    setEventTime("");
    touch("eventDate");
  };

  const handleAltDateClick = (date: string) => {
    setEventDate(date);
    // Keep current time selection — availability will recompute immediately
    // (if that time is now blocked, the useEffect above will clear it)
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!isValid) return;
    setSubmitting(true);
    try {
      // Fetch availability fresh at click time — never use stale cached data
      let availStatus: LeadAvailStatus = null;
      let altDates: string[] = [];
      try {
        const availRes = await fetch("/api/bookings/availability", { cache: "no-store" });
        if (availRes.ok) {
          const availability: AvailabilityData = await availRes.json();
          const blocked = getBlockedSlotsForDate(eventDate, availability);
          availStatus = blocked.has(eventTime) ? "unavailable" : "available";
          if (availStatus === "unavailable") {
            const bookedDates = new Set(availability.bookings.map((b) => b.date));
            altDates = findAlternativeDates(eventDate, bookedDates);
          }
        }
      } catch {
        // availability check failed — proceed without it, banner just won't show
      }

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          event_type: resolvedEventType,
          event_date: eventDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      onComplete(data.leadId, {
        fullName,
        email,
        eventType: resolvedEventType,
        eventDate,
        eventTime,
        availStatus,
        altDates,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-brand-text mb-1">Check Availability &amp; See Pricing</h2>
        <p className="text-brand-text-muted text-sm">
          Tell us about your event and we&rsquo;ll send you a full pricing summary instantly.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="v8-card p-6 space-y-5">

          {/* Full Name */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
              Full Name <span className="text-brand-red">*</span>
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => touch("fullName")}
              placeholder="Jane Smith"
              className={`v8-input ${fieldError("fullName") ? "border-brand-red" : ""}`}
            />
            {fieldError("fullName") && (
              <p className="mt-1 text-xs text-brand-red">{fieldError("fullName")}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
              Email Address <span className="text-brand-red">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => touch("email")}
              placeholder="jane@example.com"
              className={`v8-input ${fieldError("email") ? "border-brand-red" : ""}`}
            />
            {fieldError("email") && (
              <p className="mt-1 text-xs text-brand-red">{fieldError("email")}</p>
            )}
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
              Event Type <span className="text-brand-red">*</span>
            </label>
            <div className="relative">
              <select
                required
                value={eventTypeSelect}
                onChange={(e) => {
                  setEventTypeSelect(e.target.value);
                  if (e.target.value !== "Other") setOtherEventType("");
                  touch("eventType");
                }}
                onBlur={() => touch("eventType")}
                className={`v8-input appearance-none pr-10 ${fieldError("eventType") ? "border-brand-red" : ""}`}
              >
                <option value="" style={{ background: "#111" }}>Select event type…</option>
                {EVENT_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t} style={{ background: "#111" }}>{t}</option>
                ))}
              </select>
              {/* Custom chevron */}
              <svg
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {eventTypeSelect === "Other" && (
              <input
                type="text"
                required
                value={otherEventType}
                onChange={(e) => setOtherEventType(e.target.value)}
                onBlur={() => touch("eventType")}
                placeholder="Describe your event…"
                className={`v8-input mt-2 ${fieldError("eventType") && eventTypeSelect === "Other" ? "border-brand-red" : ""}`}
              />
            )}
            {fieldError("eventType") && (
              <p className="mt-1 text-xs text-brand-red">{fieldError("eventType")}</p>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date Picker */}
            <div>
              <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
                Event Date <span className="text-brand-red">*</span>
              </label>
              <DatePicker
                value={eventDate}
                onChange={handleDateChange}
              />
              {fieldError("eventDate") && (
                <p className="mt-1 text-xs text-brand-red">{fieldError("eventDate")}</p>
              )}
            </div>

            {/* Time grid */}
            <div>
              <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
                Start Time <span className="text-brand-red">*</span>
              </label>
              <div className="bg-brand-dark-surface border border-brand-border-subtle rounded-md p-3 min-h-[50px]">
                {!eventDate ? (
                  <p className="text-brand-text-muted text-sm text-center py-2">Select a date first</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1 max-h-56 overflow-y-auto pr-1">
                    {ALL_SLOTS.map((slot) => {
                      const blocked = allBlockedSlots.has(slot.value);
                      const selected = eventTime === slot.value;
                      return (
                        <button
                          key={slot.value}
                          type="button"
                          disabled={blocked}
                          onClick={() => { if (!blocked) { setEventTime(slot.value); touch("eventTime"); } }}
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
              {fieldError("eventTime") && (
                <p className="mt-1 text-xs text-brand-red">{fieldError("eventTime")}</p>
              )}
            </div>
          </div>

        </div>

        <button
          type="submit"
          disabled={submitting}
          className="btn-v8-red w-full sm:w-auto disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Checking availability…" : "Check Availability & See Pricing →"}
        </button>
      </form>
    </div>
  );
}
