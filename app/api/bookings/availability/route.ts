import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = createAdminClient();

  const [bookingsRes, configRes] = await Promise.all([
    db
      .from("sim_bookings")
      .select("event_date, event_time, duration_hours, status")
      .in("status", ["pending", "approved"]),
    db.from("sim_pricing_config").select("travel_buffer_hours").limit(1).single(),
  ]);

  const bookings = (bookingsRes.data ?? []).map((b) => ({
    date: b.event_date as string,
    // event_time comes back as "HH:MM:SS" — normalize to "HH:MM"
    startTime: (b.event_time as string).slice(0, 5),
    durationHours: b.duration_hours as number,
  }));

  const travelBufferHours: number = configRes.data?.travel_buffer_hours ?? 1;

  return NextResponse.json({ bookings, travelBufferHours });
}
