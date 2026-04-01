"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { calculatePricing } from "@/lib/pricing";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BookingProgressBar from "@/components/booking/BookingProgressBar";
import PriceSummary from "@/components/booking/PriceSummary";
import Step0Lead from "@/components/booking/Step0Lead";
import Step1Package from "@/components/booking/Step1Package";
import Step2Addons from "@/components/booking/Step2Addons";
import Step3Details from "@/components/booking/Step3Details";
import Step4Payment from "@/components/booking/Step4Payment";
import { type LeadAvailStatus } from "@/components/booking/Step0Lead";
import type {
  SimPackage,
  SimAddon,
  SimPricingConfig,
  BookingFormState,
  PricingBreakdown,
} from "@/types/booking";

const INITIAL_STATE: BookingFormState = {
  packageKey: null,
  customHours: 2,
  selectedAddons: [],
  eventType: "",
  eventDate: "",
  eventTime: "",
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  clientNotes: "",
  expectedGuests: "",
  hasSpaceConfirmed: false,
  hasPowerConfirmed: false,
};

export default function BookPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadAvailStatus, setLeadAvailStatus] = useState<LeadAvailStatus>(null);
  const [leadAltDates, setLeadAltDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<SimPackage[]>([]);
  const [addons, setAddons] = useState<SimAddon[]>([]);
  const [config, setConfig] = useState<SimPricingConfig | null>(null);
  const [formState, setFormState] = useState<BookingFormState>(INITIAL_STATE);

  useEffect(() => {
    async function load() {
      const leadParam = searchParams.get("lead");

      const [pkgRes, addonRes, configRes] = await Promise.all([
        supabase.from("sim_packages").select("*").eq("is_active", true).order("display_order"),
        supabase.from("sim_addons").select("*").eq("is_active", true),
        supabase.from("sim_pricing_config").select("*").limit(1).single(),
      ]);
      if (pkgRes.data) setPackages(pkgRes.data);
      if (addonRes.data) setAddons(addonRes.data);
      if (configRes.data) setConfig(configRes.data);

      // Restore from server-side lead progress if ?lead= param present
      if (leadParam) {
        try {
          const res = await fetch(`/api/leads/${leadParam}/progress`);
          if (res.ok) {
            const data = await res.json();

            // Already submitted — redirect to success page
            if (data.converted) {
              const dest = data.bookingId
                ? `/book/success?id=${data.bookingId}`
                : "/book/success";
              router.replace(dest);
              return;
            }

            setLeadId(leadParam);
            if (data.formProgress && data.currentStep >= 1) {
              setFormState(data.formProgress);
              setStep(data.currentStep);
            } else {
              // Older lead with no saved step — at least prefill Step 0 data
              setFormState((prev) => ({
                ...prev,
                fullName: data.fullName ?? "",
                email: data.email ?? "",
                eventType: data.eventType ?? "",
                eventDate: data.eventDate ?? "",
              }));
              setStep(1);
            }
            toast.success("Welcome back! Resuming where you left off.");
          }
        } catch {
          // ignore — just start fresh
        }
      }

      setLoading(false);
    }
    load();
  }, [searchParams]);

  const updateForm = (updates: Partial<BookingFormState>) => {
    setFormState((prev) => ({ ...prev, ...updates }));
  };

  const pricing: PricingBreakdown | null =
    config && formState.packageKey
      ? calculatePricing(
          packages.find((p) => p.key === formState.packageKey) ?? null,
          formState.customHours,
          formState.selectedAddons,
          config
        )
      : null;

  const selectedPackage = packages.find((p) => p.key === formState.packageKey) ?? null;
  const durationHours = selectedPackage ? selectedPackage.hours : formState.customHours;

  const handleLeadComplete = (
    id: string,
    data: { fullName: string; email: string; eventType: string; eventDate: string; eventTime: string; availStatus: LeadAvailStatus; altDates: string[] }
  ) => {
    setLeadId(id);
    setLeadAvailStatus(data.availStatus);
    setLeadAltDates(data.altDates);
    updateForm({
      fullName: data.fullName,
      email: data.email,
      eventType: data.eventType,
      eventDate: data.eventDate,
      eventTime: data.eventTime,
    });
    setStep(1);
  };

  const handleSaveForLater = async () => {
    if (!leadId) {
      toast("Fill in your details first, then save your progress.");
      return;
    }
    try {
      // Save full progress server-side (sends resume email)
      await fetch(`/api/leads/${leadId}/save-progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formState, step }),
      });

      // If on step 1 with a package selected, also save package (sends pricing email if not sent yet)
      if (step === 1 && formState.packageKey) {
        await fetch(`/api/leads/${leadId}/save-package`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packageKey: formState.packageKey }),
        }).catch(console.error);
        toast.success("Progress saved! Check your email for a resume link.");
      } else {
        toast.success("Progress saved! Check your email for a resume link.");
      }
    } catch {
      toast.error("Couldn't save progress. Please try again.");
    }
  };

  const handleSuccess = (bookingId: string) => {
    router.push(`/book/success?id=${bookingId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="w-8 h-8 animate-spin text-brand-red" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-brand-text-muted text-sm uppercase tracking-widest">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black flex flex-col">
      <Navbar />

      <main className="flex-1 pt-28 pb-16">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-10">
            <p className="text-brand-red text-xs uppercase tracking-widest font-semibold mb-2">Private Event Booking</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-brand-text">Book Your V8 Sim Experience</h1>
          </div>

          {step > 0 && <BookingProgressBar currentStep={step} />}

          {/* Step 0 — centered, no sidebar */}
          {step === 0 && (
            <div className="max-w-2xl mx-auto">
              <Step0Lead
                initialData={{
                  fullName: formState.fullName,
                  email: formState.email,
                  eventType: formState.eventType,
                  eventDate: formState.eventDate,
                  eventTime: formState.eventTime,
                }}
                onComplete={handleLeadComplete}
              />
            </div>
          )}

          {/* Steps 1-4 — 3-column grid with sidebar */}
          {step > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Main form */}
              <div className="lg:col-span-2">
                {/* Availability banner from Step 0 */}
                {step === 1 && leadAvailStatus === "available" && (
                  <div className="flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 mb-5 animate-fade-in">
                    <svg className="w-5 h-5 text-green-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm text-green-300 leading-snug">
                      <span className="font-semibold">Great news</span> —{" "}
                      {formState.eventDate && new Date(formState.eventDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at{" "}
                      {formState.eventTime && (() => { const [h, m] = formState.eventTime.split(":").map(Number); const p = h < 12 ? "AM" : "PM"; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}:${String(m).padStart(2, "0")} ${p}`; })()} is available! Here are our packages:
                    </p>
                  </div>
                )}
                {step === 1 && leadAvailStatus === "unavailable" && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 mb-5 space-y-3 animate-fade-in">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      <p className="text-sm text-amber-300 leading-snug">
                        <span className="font-semibold">
                          {formState.eventDate && new Date(formState.eventDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at{" "}
                          {formState.eventTime && (() => { const [h, m] = formState.eventTime.split(":").map(Number); const p = h < 12 ? "AM" : "PM"; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}:${String(m).padStart(2, "0")} ${p}`; })()}
                        </span> is already reserved.
                      </p>
                    </div>
                    {leadAltDates.length > 0 && (
                      <div>
                        <p className="text-xs text-amber-400/70 uppercase tracking-widest font-semibold mb-2">These nearby dates are open:</p>
                        <div className="flex flex-wrap gap-2">
                          {leadAltDates.map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => {
                                updateForm({ eventDate: d, eventTime: "" });
                                setLeadAvailStatus(null);
                              }}
                              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/60 transition-colors"
                            >
                              {new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {step === 1 && config && (
                  <Step1Package
                    packages={packages}
                    config={config}
                    formState={formState}
                    leadId={leadId}
                    onUpdate={updateForm}
                    onNext={() => setStep(2)}
                    onBack={() => setStep(0)}
                    onSave={handleSaveForLater}
                  />
                )}
                {step === 2 && config && (
                  <Step2Addons
                    addons={addons}
                    packages={packages}
                    config={config}
                    formState={formState}
                    onUpdate={updateForm}
                    onNext={() => setStep(3)}
                    onBack={() => setStep(1)}
                    onSave={handleSaveForLater}
                  />
                )}
                {step === 3 && (
                  <Step3Details
                    formState={formState}
                    durationHours={durationHours}
                    onUpdate={updateForm}
                    onNext={() => setStep(4)}
                    onBack={() => setStep(2)}
                    onSave={handleSaveForLater}
                  />
                )}
                {step === 4 && pricing && (
                  <Step4Payment
                    formState={formState}
                    pricing={pricing}
                    selectedPackage={selectedPackage}
                    onBack={() => setStep(3)}
                    onSuccess={handleSuccess}
                    onSave={handleSaveForLater}
                  />
                )}
              </div>

              {/* Price summary sidebar */}
              <div className="lg:col-span-1">
                <div className="lg:sticky lg:top-8">
                  <PriceSummary pricing={pricing} step={step} />

                  {step >= 2 && formState.selectedAddons.length > 0 && (
                    <div className="v8-card p-4 mt-4">
                      <p className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-3">
                        Selected Add-ons
                      </p>
                      <ul className="space-y-1.5">
                        {formState.selectedAddons.map((a) => (
                          <li key={a.key} className="text-sm text-brand-text flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-brand-red rounded-full" />
                            {a.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
