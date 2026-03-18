import { Suspense } from "react";
import SuccessContent from "./SuccessContent";

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-black flex items-center justify-center text-brand-text-muted">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
