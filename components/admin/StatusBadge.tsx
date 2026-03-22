import type { BookingStatus } from "@/types/booking";

const styles: Record<BookingStatus, string> = {
  awaiting_payment: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  approved: "bg-green-500/20 text-green-400 border border-green-500/30",
  declined: "bg-red-500/20 text-red-400 border border-red-500/30",
  cancelled: "bg-gray-500/20 text-gray-400 border border-gray-500/30",
  completed: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
};

const labels: Record<BookingStatus, string> = {
  awaiting_payment: "Awaiting Payment",
  pending: "Pending",
  approved: "Approved",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
};

export default function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
