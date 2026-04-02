import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { sendLeadPricingSummary } from "@/lib/resend";

export async function POST(req: Request) {
  try {
    const body: { full_name: string; email: string; event_type: string; event_date: string } = await req.json();
    const { full_name, email, event_type, event_date } = body;

    if (!full_name || !email || !event_type || !event_date) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const db = createAdminClient();

    // Upsert: if same email + event_date exists, reuse that lead
    const { data: existing } = await db
      .from("sim_leads")
      .select("id")
      .eq("email", email)
      .eq("event_date", event_date)
      .maybeSingle();

    let leadId: string;

    if (existing) {
      leadId = existing.id;
      await db
        .from("sim_leads")
        .update({ full_name, event_type })
        .eq("id", leadId);
    } else {
      const { data: lead, error } = await db
        .from("sim_leads")
        .insert({ full_name, email, event_type, event_date })
        .select("id")
        .single();
      if (error || !lead) throw new Error("Failed to save lead");
      leadId = lead.id;
    }

    // Fetch addons for dynamic pricing email display
    const { data: addons } = await db
      .from("sim_addons")
      .select("label, price, is_per_hour")
      .eq("is_active", true);

    const firstName = full_name.split(" ")[0];
    try {
      await sendLeadPricingSummary({
        firstName, email, eventType: event_type, eventDate: event_date,
        leadId, addons: addons ?? undefined,
      });
      await db.from("sim_leads")
        .update({ pricing_email_sent_at: new Date().toISOString() })
        .eq("id", leadId);
    } catch (emailErr) {
      console.error("[POST /api/leads] email error:", emailErr);
    }

    return NextResponse.json({ leadId });
  } catch (err: unknown) {
    console.error("[POST /api/leads]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
