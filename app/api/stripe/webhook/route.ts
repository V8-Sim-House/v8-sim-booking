import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase";

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
    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      // Mark booking as declined if it was still pending
      await db
        .from("sim_bookings")
        .update({ status: "declined" })
        .eq("stripe_payment_intent_id", pi.id)
        .eq("status", "pending");
      break;
    }
    case "payment_intent.canceled": {
      const pi = event.data.object;
      await db
        .from("sim_bookings")
        .update({ status: "declined" })
        .eq("stripe_payment_intent_id", pi.id)
        .eq("status", "pending");
      break;
    }
    default:
      // Ignore other events
      break;
  }

  return NextResponse.json({ received: true });
}
