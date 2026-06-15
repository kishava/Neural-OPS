import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceServer } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { email, password, full_name } = await request.json();

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { error: "Missing email, password, or full_name" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceServer();
    if (!supabase) {
      return NextResponse.json(
        { error: "Auth service unavailable" },
        { status: 500 }
      );
    }

    // Use admin API to create and auto-confirm user
    const { data, error } = await supabase.auth.admin.createUser({
      email: email.trim(),
      password,
      user_metadata: { full_name: full_name.trim() },
      email_confirm: true, // Auto-confirm the email
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Sign up failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, user: data.user });
  } catch (err) {
    console.error("[signup] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
