import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("sim_bookings")
    .select("*, clients(*), sim_booking_addons(*)")
    .eq("id", params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
