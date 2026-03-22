import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { sendEventReminder } from "@/lib/resend";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Protect the endpoint — only allow Vercel Cron calls
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  // Find all approved bookings happening tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0]; // YYYY-MM-DD

  const { data: bookings, error } = await db
    .from("sim_bookings")
    .select("*, clients(full_name, email)")
    .eq("status", "approved")
    .eq("event_date", tomorrowStr);

  if (error) {
    console.error("[cron/reminders]", error);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const results = await Promise.allSettled(
    bookings.map((booking) => {
      const client = booking.clients as { full_name: string; email: string } | null;
      if (!client) return Promise.resolve();
      return sendEventReminder({
        clientName: client.full_name,
        clientEmail: client.email,
        eventDate: booking.event_date,
        eventTime: booking.event_time,
        remainderAmount: booking.remainder_amount,
      });
    })
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  console.log(`[cron/reminders] Sent ${bookings.length - failed}/${bookings.length} reminders for ${tomorrowStr}`);

  return NextResponse.json({ sent: bookings.length - failed, failed });
}
