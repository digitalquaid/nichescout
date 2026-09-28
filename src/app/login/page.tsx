"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <h1 className="text-lg font-semibold">NicheScout Admin</h1>
        </div>

        <label className="mb-1 block text-sm text-muted">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        />

        <label className="mb-1 block text-sm text-muted">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        />

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-bg disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-4 text-xs text-muted">
          Admin accounts are created in the Supabase dashboard (Authentication → Users). There is no public signup.
        </p>
      </form>
    </div>
  );
}
