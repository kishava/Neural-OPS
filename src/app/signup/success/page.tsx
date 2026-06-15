"use client";

import Link from "next/link";
import { CheckCircle, Mail, Radio } from "lucide-react";
import { NeonButton } from "@/components/ui/NeonButton";
import { APP_NAME } from "@/lib/constants";

export default function SignUpSuccessPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10">
            <Radio className="h-5 w-5 text-cyan-400" />
          </div>
          <span className="font-display text-base font-bold tracking-widest text-white">{APP_NAME}</span>
        </div>

        <div className="glass-premium rounded-2xl border border-cyan-500/20 p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
            <CheckCircle className="h-7 w-7 text-emerald-400" />
          </div>

          <h1 className="font-display mb-2 text-xl font-semibold text-white">
            Account Created
          </h1>
          <p className="mb-6 font-mono text-[12px] leading-relaxed text-slate-400">
            Your account is ready to use! Sign in to access the operations platform. You can verify your email anytime in profile settings.
          </p>

          <div className="mb-6 flex items-center justify-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/60 px-4 py-3">
            <Mail className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="font-mono text-[11px] text-slate-400">
              Email verification is optional
            </span>
          </div>

          <div className="space-y-2">
            <NeonButton href="/login" className="w-full justify-center">
              Return to Sign In
            </NeonButton>
            <Link
              href="/"
              className="block w-full py-2.5 font-mono text-xs text-slate-500 transition-colors hover:text-slate-300"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
