import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase";
import type { BookingFormState, PricingBreakdown } from "@/types/booking";

export async function POST(req: Request) {
  try {
    const body: { formState: BookingFormState; pricing: PricingBreakdown } = await req.json();
    const { formState, pricing } = body;

    const db = createAdminClient();

    // 1. Upsert client
    const { data: existingClient } = await db
      .from("clients")
      .select("id")
      .eq("email", formState.email)
      .single();

    let clientId: string;

    if (existingClient) {
      clientId = existingClient.id;
      await db.from("clients").update({ full_name: formState.fullName, phone: formState.phone }).eq("id", clientId);
    } else {
      const { data: newClient, error: clientError } = await db
        .from("clients")
        .insert({ full_name: formState.fullName, email: formState.email, phone: formState.phone })
        .select("id")
        .single();
      if (clientError || !newClient) throw new Error("Failed to create client");
      clientId = newClient.id;
    }

    // 2. Find or create Stripe Customer so the payment method can be saved for the remainder charge
    const existingCustomers = await stripe.customers.list({ email: formState.email, limit: 1 });
    const stripeCustomerId =
      existingCustomers.data.length > 0
        ? existingCustomers.data[0].id
        : (await stripe.customers.create({ email: formState.email, name: formState.fullName })).id;

    // 3. Create Stripe PaymentIntent (manual capture = authorize only)
    const depositInCents = Math.round(pricing.depositAmount * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: depositInCents,
      currency: "usd",
      capture_method: "manual",
      customer: stripeCustomerId,
      setup_future_usage: "off_session",
      description: `V8 Sim deposit — ${pricing.packageLabel} — ${formState.eventDate}`,
      metadata: { client_email: formState.email, event_date: formState.eventDate },
    });

    // 4. Determine duration
    const durationHours = formState.packageKey === "custom"
      ? formState.customHours
      : (formState.selectedAddons.length > 0 ? formState.customHours : formState.customHours);

    // 5. Insert booking
    const { data: booking, error: bookingError } = await db
      .from("sim_bookings")
      .insert({
        client_id: clientId,
        status: "awaiting_payment",
        event_date: formState.eventDate,
        event_time: formState.eventTime,
        duration_hours: durationHours,
        package_type: formState.packageKey,
        hourly_rate: null,
        setup_fee: null,
        addons_total: pricing.addonsTotal,
        subtotal: pricing.subtotal,
        deposit_amount: pricing.depositAmount,
        remainder_amount: pricing.remainderAmount,
        client_address: formState.address,
        city: formState.city,
        state: formState.state || null,
        zip: formState.zip || null,
        has_space_confirmed: formState.hasSpaceConfirmed,
        has_power_confirmed: formState.hasPowerConfirmed || formState.selectedAddons.some((a) => a.key === "generator"),
        client_notes: formState.clientNotes || null,
        stripe_payment_intent_id: paymentIntent.id,
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      await stripe.paymentIntents.cancel(paymentIntent.id);
      throw new Error("Failed to create booking");
    }

    // 6. Insert add-ons
    if (formState.selectedAddons.length > 0) {
      await db.from("sim_booking_addons").insert(
        formState.selectedAddons.map((a) => ({
          booking_id: booking.id,
          addon_key: a.key,
          addon_label: a.label,
          addon_price: a.price,
        }))
      );
    }

    // 7. Emails are sent via webhook (payment_intent.amount_capturable_updated)
    //    after the card hold is confirmed — not here.

    return NextResponse.json({
      bookingId: booking.id,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err: unknown) {
    console.error("[POST /api/bookings/create]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
