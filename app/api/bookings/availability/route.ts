import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function GET() {
  const db = createAdminClient();
  const { data } = await db
    .from("sim_bookings")
    .select("event_date, status")
    .in("status", ["pending", "approved"]);

  const dates = (data ?? []).map((b) => b.event_date);
  return NextResponse.json({ dates });
}
