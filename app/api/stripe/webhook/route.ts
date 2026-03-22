import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase";
import {
  sendBookingSubmittedClient,
  sendBookingSubmittedAdmin,
} from "@/lib/resend";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = createAdminClient();

  switch (event.type) {
    // Card hold succeeded — move to pending and send confirmation emails
    case "payment_intent.amount_capturable_updated": {
      const pi = event.data.object;
      const { data: booking } = await db
        .from("sim_bookings")
        .update({ status: "pending" })
        .eq("stripe_payment_intent_id", pi.id)
        .eq("status", "awaiting_payment")
        .select(`
          id, event_date, event_time, package_type, subtotal,
          deposit_amount, remainder_amount,
          clients ( full_name, email )
        `)
        .single();

      if (booking && booking.clients) {
        const raw = booking.clients;
        const client = (Array.isArray(raw) ? raw[0] : raw) as { full_name: string; email: string };
        const emailData = {
          clientName: client.full_name,
          clientEmail: client.email,
          bookingId: booking.id,
          eventDate: booking.event_date,
          eventTime: booking.event_time,
          packageLabel: booking.package_type,
          subtotal: booking.subtotal,
          depositAmount: booking.deposit_amount,
          remainderAmount: booking.remainder_amount,
        };
        Promise.all([
          sendBookingSubmittedClient(emailData),
          sendBookingSubmittedAdmin(emailData),
        ]).catch(console.error);
      }
      break;
    }
    // Card declined or cancelled — delete the incomplete booking
    case "payment_intent.payment_failed":
    case "payment_intent.canceled": {
      const pi = event.data.object;
      await db
        .from("sim_bookings")
        .delete()
        .eq("stripe_payment_intent_id", pi.id)
        .eq("status", "awaiting_payment");
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
