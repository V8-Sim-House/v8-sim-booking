interface Props {
  currentStep: number;
}

const STEPS = [
  { n: 1, label: "Package" },
  { n: 2, label: "Add-ons" },
  { n: 3, label: "Details" },
  { n: 4, label: "Payment" },
];

export default function BookingProgressBar({ currentStep }: Props) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10 px-2">
      {STEPS.map((step, i) => (
        <div key={step.n} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold border-2 transition-all duration-300 ${
                currentStep === step.n
                  ? "bg-brand-red border-brand-red text-white"
                  : currentStep > step.n
                  ? "bg-brand-red/20 border-brand-red text-brand-red"
                  : "bg-brand-border-subtle border-brand-border-subtle text-brand-text-muted"
              }`}
            >
              {currentStep > step.n ? (
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.n
              )}
            </div>
            <span
              className={`mt-1 text-[9px] sm:text-xs tracking-wide uppercase font-semibold ${
                currentStep >= step.n ? "text-brand-text" : "text-brand-text-muted"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`w-6 sm:w-14 lg:w-24 h-px mx-1 mb-4 sm:mb-5 transition-colors duration-300 ${
                currentStep > step.n ? "bg-brand-red" : "bg-brand-border-subtle"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
