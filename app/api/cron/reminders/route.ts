import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { sendEventReminder, sendLeadReminder3Week, sendLeadReminder1Week } from "@/lib/resend";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Protect the endpoint — only allow Vercel Cron calls
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  // ── 1. Booking day-before reminders ────────────────────────────────────────
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const { data: bookings, error: bookingsError } = await db
    .from("sim_bookings")
    .select("*, clients(full_name, email)")
    .eq("status", "approved")
    .eq("event_date", tomorrowStr);

  if (bookingsError) {
    console.error("[cron/reminders] bookings fetch error", bookingsError);
  }

  const bookingResults = await Promise.allSettled(
    (bookings ?? []).map((booking) => {
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

  const bookingsFailed = bookingResults.filter((r) => r.status === "rejected").length;
  const bookingsSent = (bookings?.length ?? 0) - bookingsFailed;

  // ── 2. Lead 3-week reminders ────────────────────────────────────────────────
  const in3Weeks = new Date();
  in3Weeks.setDate(in3Weeks.getDate() + 21);
  const in3WeeksStr = in3Weeks.toISOString().split("T")[0];

  const { data: leads3w } = await db
    .from("sim_leads")
    .select("id, full_name, email, event_type, event_date, selected_package")
    .eq("converted_to_booking", false)
    .eq("event_date", in3WeeksStr)
    .is("reminder_3w_sent_at", null);

  const lead3wResults = await Promise.allSettled(
    (leads3w ?? []).map(async (lead) => {
      const firstName = lead.full_name.split(" ")[0];
      await sendLeadReminder3Week({
        firstName,
        email: lead.email,
        eventType: lead.event_type,
        eventDate: lead.event_date,
        selectedPackage: lead.selected_package,
        leadId: lead.id,
      });
      await db
        .from("sim_leads")
        .update({ reminder_3w_sent_at: new Date().toISOString() })
        .eq("id", lead.id);
    })
  );

  const leads3wFailed = lead3wResults.filter((r) => r.status === "rejected").length;
  const leads3wSent = (leads3w?.length ?? 0) - leads3wFailed;

  // ── 3. Lead 1-week reminders ────────────────────────────────────────────────
  const in1Week = new Date();
  in1Week.setDate(in1Week.getDate() + 7);
  const in1WeekStr = in1Week.toISOString().split("T")[0];

  const { data: leads1w } = await db
    .from("sim_leads")
    .select("id, full_name, email, event_type, event_date")
    .eq("converted_to_booking", false)
    .eq("event_date", in1WeekStr)
    .is("reminder_1w_sent_at", null);

  const lead1wResults = await Promise.allSettled(
    (leads1w ?? []).map(async (lead) => {
      const firstName = lead.full_name.split(" ")[0];
      await sendLeadReminder1Week({
        firstName,
        email: lead.email,
        eventType: lead.event_type,
        eventDate: lead.event_date,
        leadId: lead.id,
      });
      await db
        .from("sim_leads")
        .update({ reminder_1w_sent_at: new Date().toISOString() })
        .eq("id", lead.id);
    })
  );

  const leads1wFailed = lead1wResults.filter((r) => r.status === "rejected").length;
  const leads1wSent = (leads1w?.length ?? 0) - leads1wFailed;

  console.log(
    `[cron/reminders] bookings=${bookingsSent}/${bookings?.length ?? 0} ` +
    `leads_3w=${leads3wSent}/${leads3w?.length ?? 0} ` +
    `leads_1w=${leads1wSent}/${leads1w?.length ?? 0}`
  );

  return NextResponse.json({
    bookings: { sent: bookingsSent, failed: bookingsFailed },
    leads3w: { sent: leads3wSent, failed: leads3wFailed },
    leads1w: { sent: leads1wSent, failed: leads1wFailed },
  });
}
