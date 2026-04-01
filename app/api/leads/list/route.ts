import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { requireAdminAuth } from "@/lib/admin-auth";

export async function GET(req: Request) {
  const auth = await requireAdminAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const converted = searchParams.get("converted");

  const db = createAdminClient();

  let query = db
    .from("sim_leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (converted === "true") query = query.eq("converted_to_booking", true);
  if (converted === "false") query = query.eq("converted_to_booking", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
