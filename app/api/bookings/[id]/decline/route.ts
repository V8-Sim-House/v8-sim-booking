import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/admin-auth";
import { sendBookingDeclined } from "@/lib/resend";

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
  if (booking.status !== "pending") return NextResponse.json({ error: "Booking is not pending" }, { status: 400 });

  try {
    const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);

    if (pi.status === "succeeded") {
      // Already captured — issue a full refund instead of canceling
      await stripe.refunds.create({ payment_intent: booking.stripe_payment_intent_id });
    } else if (pi.status !== "canceled") {
      // Still holds a hold or is in-flight — cancel to release it
      await stripe.paymentIntents.cancel(booking.stripe_payment_intent_id);
    }
    // If already canceled, no Stripe action needed

    await db.from("sim_bookings").update({ status: "declined" }).eq("id", params.id);

    const client = booking.clients;
    if (client) {
      sendBookingDeclined({
        clientName: client.full_name,
        clientEmail: client.email,
        bookingId: params.id,
      }).catch(console.error);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[decline]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to decline" },
      { status: 500 }
    );
  }
}
