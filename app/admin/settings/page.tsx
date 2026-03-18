"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/admin/AdminNav";
import { toast } from "sonner";
import type { SimPackage, SimAddon, SimPricingConfig } from "@/types/booking";

export default function SettingsPage() {
  const [config, setConfig] = useState<SimPricingConfig | null>(null);
  const [packages, setPackages] = useState<SimPackage[]>([]);
  const [addons, setAddons] = useState<SimAddon[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [pkgRes, addonRes, configRes] = await Promise.all([
      supabase.from("sim_packages").select("*").order("display_order"),
      supabase.from("sim_addons").select("*"),
      supabase.from("sim_pricing_config").select("*").limit(1).single(),
    ]);
    if (pkgRes.data) setPackages(pkgRes.data);
    if (addonRes.data) setAddons(addonRes.data);
    if (configRes.data) setConfig(configRes.data);
  };

  useEffect(() => { load(); }, []);

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase
      .from("sim_pricing_config")
      .update({
        hourly_rate: config.hourly_rate,
        setup_fee: config.setup_fee,
        deposit_percent: config.deposit_percent,
        travel_buffer_hours: config.travel_buffer_hours,
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);
    setSaving(false);
    if (error) toast.error("Failed to save config");
    else toast.success("Pricing config saved");
  };

  const updatePackage = async (pkg: SimPackage, field: keyof SimPackage, value: unknown) => {
    const updated = packages.map((p) => p.id === pkg.id ? { ...p, [field]: value } : p);
    setPackages(updated);
    await supabase.from("sim_packages").update({ [field]: value }).eq("id", pkg.id);
    toast.success(`${pkg.label} updated`);
  };

  const updateAddon = async (addon: SimAddon, field: keyof SimAddon, value: unknown) => {
    const updated = addons.map((a) => a.id === addon.id ? { ...a, [field]: value } : a);
    setAddons(updated);
    await supabase.from("sim_addons").update({ [field]: value }).eq("id", addon.id);
    toast.success(`${addon.label} updated`);
  };

  return (
    <div className="min-h-screen bg-brand-black">
      <AdminNav />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <h1 className="text-2xl font-bold text-brand-text">Settings</h1>

        {/* Pricing config */}
        {config && (
          <div className="v8-card p-6">
            <h2 className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-6">Pricing Configuration</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
                  Hourly Rate (Custom)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={config.hourly_rate}
                    onChange={(e) => setConfig({ ...config, hourly_rate: parseFloat(e.target.value) })}
                    className="v8-input pl-7"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
                  Setup Fee
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={config.setup_fee}
                    onChange={(e) => setConfig({ ...config, setup_fee: parseFloat(e.target.value) })}
                    className="v8-input pl-7"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
                  Deposit %
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={config.deposit_percent}
                    onChange={(e) => setConfig({ ...config, deposit_percent: parseInt(e.target.value) })}
                    className="v8-input pr-7"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
                  Travel Buffer
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="4"
                    step="0.5"
                    value={config.travel_buffer_hours}
                    onChange={(e) => setConfig({ ...config, travel_buffer_hours: parseFloat(e.target.value) })}
                    className="v8-input pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted text-sm">hrs</span>
                </div>
                <p className="text-xs text-brand-text-muted mt-1">Blocked before &amp; after each booking for travel/setup.</p>
              </div>
            </div>
            <p className="text-xs text-brand-text-muted mb-4">
              Note: Changing pricing does not affect existing bookings — prices are snapshotted at booking time.
            </p>
            <button onClick={saveConfig} disabled={saving} className="btn-v8-red disabled:opacity-50">
              {saving ? "Saving..." : "Save Pricing Config"}
            </button>
          </div>
        )}

        {/* Packages */}
        <div className="v8-card p-6">
          <h2 className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-6">Packages</h2>
          <div className="space-y-4">
            {packages.map((pkg) => (
              <div key={pkg.id} className="flex items-center gap-4 py-3 border-b border-brand-border-subtle last:border-0">
                <div className="flex-1">
                  <p className="text-brand-text font-semibold text-sm">{pkg.label}</p>
                  <p className="text-brand-text-muted text-xs">{pkg.hours}h · price = hourly_rate × {pkg.hours}h minus discount</p>
                </div>
                <div className="relative w-28">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    defaultValue={pkg.discount_percent ?? 0}
                    onBlur={(e) => updatePackage(pkg, "discount_percent", parseFloat(e.target.value))}
                    className="v8-input pr-7 text-sm py-2"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted text-sm">%</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={pkg.is_active}
                    onChange={(e) => updatePackage(pkg, "is_active", e.target.checked)}
                    className="accent-brand-red w-4 h-4"
                  />
                  <span className="text-xs text-brand-text-muted">Active</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Add-ons */}
        <div className="v8-card p-6">
          <h2 className="text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-6">Add-ons</h2>
          <div className="space-y-4">
            {addons.map((addon) => (
              <div key={addon.id} className="flex items-center gap-4 py-3 border-b border-brand-border-subtle last:border-0">
                <div className="flex-1">
                  <p className="text-brand-text font-semibold text-sm">{addon.label}</p>
                  <p className="text-brand-text-muted text-xs">{addon.description}</p>
                  <p className="text-xs mt-0.5">
                    {addon.is_per_hour
                      ? <span className="text-brand-red">Per-hour rate</span>
                      : <span className="text-brand-text-muted">Flat fee</span>}
                  </p>
                </div>
                <div className="relative w-28">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={addon.price}
                    onBlur={(e) => updateAddon(addon, "price", parseFloat(e.target.value))}
                    className="v8-input pl-7 text-sm py-2"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={addon.is_active}
                    onChange={(e) => updateAddon(addon, "is_active", e.target.checked)}
                    className="accent-brand-red w-4 h-4"
                  />
                  <span className="text-xs text-brand-text-muted">Active</span>
                </label>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
