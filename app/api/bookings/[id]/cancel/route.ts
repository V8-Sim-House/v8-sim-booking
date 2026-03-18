import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/admin-auth";
import { sendBookingCancelled } from "@/lib/resend";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;

  const db = createAdminClient();
  const { data: booking } = await db
    .from("sim_bookings")
    .select("*, clients(*)")
    .eq("id", params.id)
    .single();

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.status !== "approved") return NextResponse.json({ error: "Booking is not approved" }, { status: 400 });

  try {
    // Cancel remainder intent if it exists
    if (booking.stripe_remainder_intent_id) {
      try {
        await stripe.paymentIntents.cancel(booking.stripe_remainder_intent_id);
      } catch {
        // May already be cancelled — ignore
      }
    }

    await db.from("sim_bookings").update({ status: "cancelled" }).eq("id", params.id);

    const client = booking.clients;
    if (client) {
      sendBookingCancelled({
        clientName: client.full_name,
        clientEmail: client.email,
        eventDate: booking.event_date,
        depositAmount: booking.deposit_amount,
      }).catch(console.error);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[cancel]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to cancel" },
      { status: 500 }
    );
  }
}
