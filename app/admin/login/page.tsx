"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      router.push("/admin/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Image src="/v8_logo_red.png" alt="V8 Sim" width={100} height={34} className="mx-auto mb-6 h-10 w-auto" />
          <h1 className="text-2xl font-bold text-brand-text">Admin Login</h1>
          <p className="text-brand-text-muted text-sm mt-1">V8 Sim Booking System</p>
        </div>

        <form onSubmit={handleLogin} className="v8-card p-8 space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="v8-input"
              placeholder="admin@example.com"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-brand-text-muted font-semibold mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="v8-input"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-v8-red w-full mt-2 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
