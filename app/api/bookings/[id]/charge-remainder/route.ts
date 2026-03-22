import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/admin-auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;

  const db = createAdminClient();
  const { data: booking } = await db
    .from("sim_bookings")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (booking.status !== "approved") return NextResponse.json({ error: "Booking is not approved" }, { status: 400 });
  if (!booking.stripe_remainder_intent_id) return NextResponse.json({ error: "No remainder payment intent" }, { status: 400 });

  try {
    // Confirm + capture remainder
    const pi = await stripe.paymentIntents.retrieve(booking.stripe_remainder_intent_id);

    if (pi.status === "canceled") {
      // PI expired (Stripe cancels after 7 days) — create a new one using saved payment method
      const depositPi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
      if (!depositPi.customer || !depositPi.payment_method) {
        return NextResponse.json(
          { error: "Cannot recharge: no saved payment method on file. Please charge manually in Stripe dashboard." },
          { status: 400 }
        );
      }
      const newRemainder = await stripe.paymentIntents.create({
        amount: Math.round(booking.remainder_amount * 100),
        currency: "usd",
        customer: depositPi.customer as string,
        payment_method: depositPi.payment_method as string,
        off_session: true,
        confirm: true,
        description: `V8 Sim remainder (reissued) — booking #${params.id.slice(0, 8)}`,
        metadata: { booking_id: params.id },
      });
      await db.from("sim_bookings").update({
        status: "completed",
        stripe_remainder_intent_id: newRemainder.id,
        remainder_captured_at: new Date().toISOString(),
      }).eq("id", params.id);
      return NextResponse.json({ success: true });
    }

    if (pi.status === "requires_payment_method" || pi.status === "requires_confirmation") {
      return NextResponse.json(
        { error: "Remainder payment method not set up. Please charge manually in Stripe dashboard." },
        { status: 400 }
      );
    }

    if (pi.status === "requires_capture") {
      await stripe.paymentIntents.capture(booking.stripe_remainder_intent_id);
    }

    await db.from("sim_bookings").update({
      status: "completed",
      remainder_captured_at: new Date().toISOString(),
    }).eq("id", params.id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[charge-remainder]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to charge remainder" },
      { status: 500 }
    );
  }
}
