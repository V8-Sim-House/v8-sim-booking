"use client";
import { useEffect, useState } from "react";
import AdminNav from "@/components/admin/AdminNav";
import type { SimLead } from "@/types/booking";

const PACKAGE_LABELS: Record<string, string> = {
  standard_1h: "1 Hour",
  standard_2h: "2 Hour",
  standard_3h: "3 Hour",
  custom: "Custom",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<SimLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [convertedFilter, setConvertedFilter] = useState<"" | "true" | "false">("");

  useEffect(() => {
    async function load() {
      const params = convertedFilter !== "" ? `?converted=${convertedFilter}` : "";
      const res = await fetch(`/api/leads/list${params}`);
      const data = res.ok ? await res.json() : [];
      setLeads(data as SimLead[]);
      setLoading(false);
    }
    load();
  }, [convertedFilter]);

  const filtered = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.full_name.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.event_type.toLowerCase().includes(q)
    );
  });

  const convertedCount = leads.filter((l) => l.converted_to_booking).length;
  const conversionRate = leads.length > 0 ? Math.round((convertedCount / leads.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-brand-black">
      <AdminNav />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-brand-text">Leads</h1>
          <span className="text-brand-text-muted text-sm">{filtered.length} results</span>
        </div>

        {/* Stats row */}
        {leads.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="v8-card p-4">
              <p className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-1">Total Leads</p>
              <p className="text-2xl font-bold text-brand-text">{leads.length}</p>
            </div>
            <div className="v8-card p-4">
              <p className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-1">Converted</p>
              <p className="text-2xl font-bold text-green-400">{convertedCount}</p>
            </div>
            <div className="v8-card p-4">
              <p className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-1">Unconverted</p>
              <p className="text-2xl font-bold text-brand-red">{leads.length - convertedCount}</p>
            </div>
            <div className="v8-card p-4">
              <p className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-1">Conversion Rate</p>
              <p className="text-2xl font-bold text-brand-text">{conversionRate}%</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <input
            type="text"
            placeholder="Search by name, email, or event type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="v8-input text-sm"
          />
          <select
            value={convertedFilter}
            onChange={(e) => setConvertedFilter(e.target.value as "" | "true" | "false")}
            className="v8-input text-sm"
          >
            <option value="" style={{ background: "#111" }}>All Leads</option>
            <option value="false" style={{ background: "#111" }}>Unconverted</option>
            <option value="true" style={{ background: "#111" }}>Converted</option>
          </select>
        </div>

        {/* Table */}
        <div className="v8-card overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-brand-text-muted">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-brand-text-muted">No leads found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-border-subtle">
                    {["Name", "Email", "Event Type", "Event Date", "Package Interest", "Pricing Email", "Reminders", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-widest text-brand-text-muted font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead) => (
                    <tr key={lead.id} className="border-b border-brand-border-subtle hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-brand-text font-medium">{lead.full_name}</td>
                      <td className="px-4 py-3 text-brand-text-muted">{lead.email}</td>
                      <td className="px-4 py-3 text-brand-text-muted">{lead.event_type}</td>
                      <td className="px-4 py-3 text-brand-text">{lead.event_date}</td>
                      <td className="px-4 py-3 text-brand-text-muted">
                        {lead.selected_package
                          ? PACKAGE_LABELS[lead.selected_package] ?? lead.selected_package
                          : <span className="text-brand-border-subtle">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {lead.pricing_email_sent_at ? (
                          <span className="text-xs text-green-400">Sent</span>
                        ) : (
                          <span className="text-xs text-brand-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 items-center">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${lead.reminder_3w_sent_at ? "bg-green-500/20 text-green-400" : "bg-brand-border-subtle text-brand-text-muted"}`}>
                            3w
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${lead.reminder_1w_sent_at ? "bg-green-500/20 text-green-400" : "bg-brand-border-subtle text-brand-text-muted"}`}>
                            1w
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {lead.converted_to_booking ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-full">
                            Booked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red bg-brand-red/10 border border-brand-red/20 px-2 py-1 rounded-full">
                            Lead
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
