import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceServer } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { writeAuthSession } from "@/lib/auth/session-cookie";

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

    const normalizedEmail = email.trim().toLowerCase();
    const name = full_name.trim();

    // 1. Create Supabase auth user with email pre-confirmed
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      user_metadata: { full_name: name },
      email_confirm: true,
    });

    if (createError) {
      return NextResponse.json(
        { error: createError.message || "Sign up failed" },
        { status: 400 }
      );
    }

    const authUserId = createData.user.id;

    // 2. Create a Prisma Organization + User so the login service can find them
    const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const slug = `${slugBase}-${Date.now()}`;

    const org = await prisma.organization.create({
      data: {
        name: `${name}'s Organization`,
        slug,
      },
    });

    const dbUser = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        role: "admin",
        authId: authUserId,
        organizationId: org.id,
      },
    });

    // 3. Sign in immediately — user is already confirmed so signInWithPassword works directly
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError || !signInData?.session) {
      // Still created OK — send them to login to sign in manually
      return NextResponse.json({ ok: true, redirect: "/login" });
    }

    // 4. Write the session cookie so the user is logged in immediately
    await writeAuthSession({
      accessToken: signInData.session.access_token,
      refreshToken: signInData.session.refresh_token,
      userId: dbUser.id,
      email: normalizedEmail,
      name,
      role: "admin",
      organizationId: org.id,
    });

    return NextResponse.json({ ok: true, redirect: "/command-center" });
  } catch (err) {
    console.error("[signup] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
