import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { sendSaveForLaterEmail } from "@/lib/resend";
import type { BookingFormState } from "@/types/booking";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { formState, step }: { formState: BookingFormState; step: number } = await req.json();

    const db = createAdminClient();

    const { data: lead, error } = await db
      .from("sim_leads")
      .select("full_name, email")
      .eq("id", params.id)
      .single();

    if (error || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    await db
      .from("sim_leads")
      .update({ form_progress: formState, current_step: step })
      .eq("id", params.id);

    const firstName = lead.full_name.split(" ")[0];
    try {
      await sendSaveForLaterEmail({ firstName, email: lead.email, leadId: params.id });
    } catch (emailErr) {
      console.error("[PATCH /api/leads/save-progress] email error:", emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[PATCH /api/leads/[id]/save-progress]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
