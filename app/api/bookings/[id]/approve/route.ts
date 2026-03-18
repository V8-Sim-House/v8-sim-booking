import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/admin-auth";
import { sendBookingApproved } from "@/lib/resend";

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
    // 1. Retrieve current PI status — handle mid-flight recovery gracefully
    const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);

    if (pi.status === "requires_capture") {
      await stripe.paymentIntents.capture(booking.stripe_payment_intent_id);
    } else if (pi.status !== "succeeded") {
      // e.g. canceled, requires_payment_method — can't approve
      return NextResponse.json(
        { error: `Cannot approve: payment is in '${pi.status}' state` },
        { status: 400 }
      );
    }
    // If already 'succeeded', deposit was captured in a prior attempt — continue to recover

    // 2. Create remainder PaymentIntent only if not already created
    let remainderIntentId = booking.stripe_remainder_intent_id ?? null;
    if (!remainderIntentId) {
      const remainderCents = Math.round(booking.remainder_amount * 100);
      const remainderIntent = await stripe.paymentIntents.create({
        amount: remainderCents,
        currency: "usd",
        capture_method: "manual",
        payment_method: pi.payment_method as string,
        confirm: false,
        description: `V8 Sim remainder — booking #${params.id.slice(0, 8)}`,
        metadata: { booking_id: params.id },
      });
      remainderIntentId = remainderIntent.id;
    }

    // 3. Update booking to approved
    await db.from("sim_bookings").update({
      status: "approved",
      deposit_captured_at: new Date().toISOString(),
      stripe_remainder_intent_id: remainderIntentId,
    }).eq("id", params.id);

    // 4. Email client
    const client = booking.clients;
    if (client) {
      sendBookingApproved({
        clientName: client.full_name,
        clientEmail: client.email,
        bookingId: params.id,
        eventDate: booking.event_date,
        eventTime: booking.event_time,
        packageLabel: booking.package_type ?? "",
        subtotal: booking.subtotal,
        depositAmount: booking.deposit_amount,
        remainderAmount: booking.remainder_amount,
      }).catch(console.error);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[approve]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to approve" },
      { status: 500 }
    );
  }
}
