"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { calculatePricing } from "@/lib/pricing";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BookingProgressBar from "@/components/booking/BookingProgressBar";
import PriceSummary from "@/components/booking/PriceSummary";
import Step1Package from "@/components/booking/Step1Package";
import Step2Addons from "@/components/booking/Step2Addons";
import Step3Details from "@/components/booking/Step3Details";
import Step4Payment from "@/components/booking/Step4Payment";
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
  hasSpaceConfirmed: false,
  hasPowerConfirmed: false,
};

export default function BookPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<SimPackage[]>([]);
  const [addons, setAddons] = useState<SimAddon[]>([]);
  const [config, setConfig] = useState<SimPricingConfig | null>(null);
  const [formState, setFormState] = useState<BookingFormState>(INITIAL_STATE);

  useEffect(() => {
    async function load() {
      const [pkgRes, addonRes, configRes] = await Promise.all([
        supabase.from("sim_packages").select("*").eq("is_active", true).order("display_order"),
        supabase.from("sim_addons").select("*").eq("is_active", true),
        supabase.from("sim_pricing_config").select("*").limit(1).single(),
      ]);
      if (pkgRes.data) setPackages(pkgRes.data);
      if (addonRes.data) setAddons(addonRes.data);
      if (configRes.data) setConfig(configRes.data);
      setLoading(false);
    }
    load();
  }, []);

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

          <BookingProgressBar currentStep={step} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Main form */}
            <div className="lg:col-span-2">
              {step === 1 && config && (
                <Step1Package
                  packages={packages}
                  config={config}
                  formState={formState}
                  onUpdate={updateForm}
                  onNext={() => setStep(2)}
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
                />
              )}
              {step === 3 && (
                <Step3Details
                  formState={formState}
                  onUpdate={updateForm}
                  onNext={() => setStep(4)}
                  onBack={() => setStep(2)}
                />
              )}
              {step === 4 && pricing && (
                <Step4Payment
                  formState={formState}
                  pricing={pricing}
                  selectedPackage={selectedPackage}
                  onBack={() => setStep(3)}
                  onSuccess={handleSuccess}
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
        </div>
      </main>

      <Footer />
    </div>
  );
}
