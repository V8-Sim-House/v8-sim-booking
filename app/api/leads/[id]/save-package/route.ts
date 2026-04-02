import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { sendLeadPricingSummary } from "@/lib/resend";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { packageKey }: { packageKey: string } = await req.json();
    if (!packageKey) return NextResponse.json({ error: "packageKey required" }, { status: 400 });

    const db = createAdminClient();

    const { data: lead, error } = await db
      .from("sim_leads")
      .select("full_name, email, event_type, event_date, pricing_email_sent_at")
      .eq("id", params.id)
      .single();

    if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    await db
      .from("sim_leads")
      .update({ selected_package: packageKey })
      .eq("id", params.id);

    // Send pricing email if not already sent
    if (!lead.pricing_email_sent_at) {
      const firstName = lead.full_name.split(" ")[0];
      const { data: addons } = await db
        .from("sim_addons")
        .select("label, price, is_per_hour")
        .eq("is_active", true);
      try {
        await sendLeadPricingSummary({
          firstName,
          email: lead.email,
          eventType: lead.event_type,
          eventDate: lead.event_date,
          leadId: params.id,
          addons: addons ?? undefined,
        });
        await db.from("sim_leads")
          .update({ pricing_email_sent_at: new Date().toISOString() })
          .eq("id", params.id);
      } catch (emailErr) {
        console.error("[save-package] email error:", emailErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[POST /api/leads/[id]/save-package]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
