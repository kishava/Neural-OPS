import { NextResponse } from "next/server";
import { createSupabaseServiceServer } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { setSessionCookies } from "@/lib/auth/session-cookie";

export const runtime = "nodejs";

interface SignUpBody {
  email?: string;
  password?: string;
  fullName?: string;
}

export async function POST(request: Request) {
  let body: SignUpBody;
  try {
    body = (await request.json()) as SignUpBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const fullName = body.fullName?.trim() ?? "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const admin = createSupabaseServiceServer();
  if (!admin) {
    return NextResponse.json(
      { error: "Auth service is not configured. Contact your administrator." },
      { status: 503 },
    );
  }

  // Create an already-confirmed user. No confirmation email is sent, so the
  // Supabase built-in SMTP rate limit is never hit and the user can sign in
  // immediately. Works with any email provider.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    const message = error.message?.toLowerCase() ?? "";
    if (message.includes("already") || message.includes("registered") || message.includes("exists")) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message || "Sign up failed." }, { status: 400 });
  }

  if (!data.user?.id) {
    return NextResponse.json({ error: "User creation failed." }, { status: 500 });
  }

  try {
    // Create Organization and User records so middleware can find the user's org
    const org = await prisma.organization.create({
      data: { name: fullName || email.split("@")[0], ownerId: data.user.id },
    });

    await prisma.user.create({
      data: {
        id: data.user.id,
        email,
        fullName: fullName || "",
        organizationId: org.id,
      },
    });

    // Set session cookies that middleware requires for protected routes
    const response = NextResponse.json({ ok: true, userId: data.user.id });
    setSessionCookies(response, {
      sessionId: data.user.id,
      organizationId: org.id,
    });

    return response;
  } catch (dbError) {
    const msg = dbError instanceof Error ? dbError.message : "Database error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
