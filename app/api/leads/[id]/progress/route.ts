import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const db = createAdminClient();

    const { data: lead, error } = await db
      .from("sim_leads")
      .select("form_progress, current_step, full_name, email, event_type, event_date, converted_to_booking")
      .eq("id", params.id)
      .single();

    if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    // If already converted, find the booking ID and redirect the user to the success page
    if (lead.converted_to_booking) {
      const { data: client } = await db
        .from("clients")
        .select("id")
        .eq("email", lead.email)
        .maybeSingle();

      let bookingId: string | null = null;
      if (client) {
        const { data: booking } = await db
          .from("sim_bookings")
          .select("id")
          .eq("client_id", client.id)
          .eq("event_date", lead.event_date)
          .neq("status", "awaiting_payment")
          .maybeSingle();
        bookingId = booking?.id ?? null;
      }

      return NextResponse.json({ converted: true, bookingId });
    }

    return NextResponse.json({
      converted: false,
      formProgress: lead.form_progress ?? null,
      currentStep: lead.current_step ?? null,
      fullName: lead.full_name,
      email: lead.email,
      eventType: lead.event_type,
      eventDate: lead.event_date,
    });
  } catch (err: unknown) {
    console.error("[GET /api/leads/[id]/progress]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
