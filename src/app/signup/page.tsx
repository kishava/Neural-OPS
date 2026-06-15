"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, Radio, ShieldCheck, UserPlus, LogIn } from "lucide-react";
import Link from "next/link";
import { NeonButton } from "@/components/ui/NeonButton";
import { APP_NAME } from "@/lib/constants";

export default function SignUpPage() {
  return (
    <Suspense fallback={<AuthShell><p className="text-center text-sm text-slate-400">Loading...</p></AuthShell>}>
      <SignUpClient />
    </Suspense>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10">
            <Radio className="h-5 w-5 text-cyan-400" />
          </div>
          <span className="font-display text-base font-bold tracking-widest text-white">{APP_NAME}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Enterprise Risk &amp; Decision Platform
          </span>
        </div>
        <div className="glass-premium rounded-2xl border border-cyan-500/20 p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

function SignUpClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async () => {
    setError(null);
    if (!name.trim()) { setError("Please enter your full name."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);

    try {
      // Create an already-confirmed account server-side (no email sent, no
      // rate limits, works with any provider).
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          fullName: name.trim(),
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setError(payload.error || "Sign up failed. Please try again.");
        return;
      }

      // Account is created and org/user records exist — log in to get session cookies
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      if (!loginRes.ok) {
        // Account was created but login failed — send to login page to try again
        router.replace("/login?registered=1");
        return;
      }

      router.replace("/command-center");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-cyan-400" />
          <h1 className="font-display text-lg font-semibold text-white">Create Account</h1>
        </div>
        <p className="font-mono text-[11px] text-slate-500">
          Request access to the operations platform
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500">
            Full Name
          </span>
          <div className="flex items-center gap-2.5 rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 transition-colors focus-within:border-cyan-500/50">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              autoComplete="name"
              className="w-full bg-transparent py-3 font-mono text-sm text-white outline-none placeholder:text-slate-600"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500">
            Email
          </span>
          <div className="flex items-center gap-2.5 rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 transition-colors focus-within:border-cyan-500/50">
            <Mail className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full bg-transparent py-3 font-mono text-sm text-white outline-none placeholder:text-slate-600"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500">
            Password
          </span>
          <div className="flex items-center gap-2.5 rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 transition-colors focus-within:border-cyan-500/50">
            <KeyRound className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              className="w-full bg-transparent py-3 font-mono text-sm text-white outline-none placeholder:text-slate-600"
            />
          </div>
          <p className="mt-1 font-mono text-[10px] text-slate-600">Minimum 8 characters required</p>
        </label>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 font-mono text-[11px] text-red-400">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-3">
        <NeonButton
          className="w-full justify-center"
          onClick={handleSignUp}
          disabled={loading || !email || !password || !name}
        >
          <UserPlus className="h-3.5 w-3.5" />
          {loading ? "Creating Account..." : "Create Account"}
        </NeonButton>

        <div className="relative flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="font-mono text-[10px] text-slate-600">or</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        <Link
          href="/login"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/50 py-2.5 font-mono text-xs text-slate-400 transition-colors hover:border-cyan-500/30 hover:text-cyan-400"
        >
          <LogIn className="h-3.5 w-3.5" />
          Already have an account? Sign in
        </Link>
      </div>
    </AuthShell>
  );
}
