import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { writeAuthSession } from "@/lib/auth/session-cookie";
import { ORGANIZATION_COOKIE_NAME } from "@/lib/auth/constants";
import { cookies } from "next/headers";
import type { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/command-center";

  if (code) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (url && anonKey) {
      // Exchange the code for a session using the anon client
      const anonClient = createClient(url, anonKey, { auth: { persistSession: false } });
      const { data: sessionData, error: sessionError } = await anonClient.auth.exchangeCodeForSession(code);

      if (!sessionError && sessionData.session) {
        const { session, user } = sessionData;

        // Attempt to look up the user's Prisma record for org/role info
        let organizationId: string | null = null;
        let role: UserRole = "analyst";
        let name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? "User";

        try {
          const { prisma } = await import("@/lib/db");
          const dbUser = await prisma.user.findFirst({
            where: { OR: [{ authId: user.id }, { email: user.email?.toLowerCase() ?? "" }] },
            include: { organization: true },
          });

          if (dbUser) {
            organizationId = dbUser.organizationId ?? null;
            role = dbUser.role;
            name = dbUser.name;

            // Sync authId if not yet stored
            if (!dbUser.authId) {
              await prisma.user.update({ where: { id: dbUser.id }, data: { authId: user.id } });
            }
          } else if (user.user_metadata?.organizationId) {
            organizationId = user.user_metadata.organizationId as string;
            role = (user.user_metadata?.role as UserRole) ?? "analyst";
          }
        } catch {
          // Prisma may not be available in edge runtime; fall back to metadata
          organizationId = user.user_metadata?.organizationId as string | null ?? null;
          role = (user.user_metadata?.role as UserRole) ?? "analyst";
        }

        if (organizationId) {
          await writeAuthSession({
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            userId: user.id,
            email: user.email ?? "",
            name,
            role,
            organizationId,
          });

          const cookieStore = await cookies();
          cookieStore.set(ORGANIZATION_COOKIE_NAME, organizationId, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
          });

          return NextResponse.redirect(`${origin}${next}`);
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
