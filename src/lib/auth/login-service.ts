import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import { writeAuthSession, type AuthSessionCookie } from "./session-cookie";

export interface LoginResult {
  session: AuthSessionCookie;
  organization: { id: string; name: string; slug: string };
}

interface SupabaseUserMetadata {
  name?: string;
  role?: string;
  organizationId?: string;
  prismaUserId?: string;
}

function readMetadata(value: unknown): SupabaseUserMetadata {
  if (!value || typeof value !== "object") return {};
  return value as SupabaseUserMetadata;
}

async function lookupDbUser(email: string) {
  try {
    return await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });
  } catch {
    return null;
  }
}

async function lookupOrganization(organizationId: string) {
  try {
    return await prisma.organization.findUnique({ where: { id: organizationId } });
  } catch {
    return null;
  }
}

export async function authenticateWithEmailPassword(email: string, password: string): Promise<LoginResult> {
  const normalizedEmail = email.trim().toLowerCase();

  const supabase = createSupabaseAdmin();
  if (!supabase) {
    throw new Error("Authentication service is not configured.");
  }

  let dbUser = await lookupDbUser(normalizedEmail);

  let authResult = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
  if (authResult.error) {
    if (!dbUser || !dbUser.organizationId) {
      throw new Error("Invalid email or password.");
    }

    const createResult = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        name: dbUser.name,
        role: dbUser.role,
        organizationId: dbUser.organizationId,
        prismaUserId: dbUser.id,
      },
    });
    if (createResult.error && !createResult.error.message.toLowerCase().includes("already")) {
      throw new Error("Invalid email or password.");
    }
    if (createResult.error && createResult.error.message.toLowerCase().includes("already")) {
      await reconcileExistingSupabaseUserPassword({
        email: normalizedEmail,
        password,
        name: dbUser.name,
        role: dbUser.role,
        organizationId: dbUser.organizationId,
        prismaUserId: dbUser.id,
      });
    }
    authResult = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (authResult.error || !authResult.data.session) {
      throw new Error("Invalid email or password.");
    }
  }

  const session = authResult.data.session;
  if (!session) throw new Error("Invalid email or password.");

  const metadata = readMetadata(session.user.user_metadata);

  if (!dbUser) {
    dbUser = await lookupDbUser(normalizedEmail);
  }

  const organizationId = dbUser?.organizationId ?? metadata.organizationId;

  // If no org found at all, auto-create one so fresh signup users can always log in
  let resolvedOrganization =
    dbUser?.organization ?? (organizationId ? await lookupOrganization(organizationId) : null);

  if (!resolvedOrganization) {
    const name = dbUser?.name ?? metadata.name ?? normalizedEmail.split("@")[0];
    const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const slug = `${slugBase}-${Date.now()}`;
    try {
      resolvedOrganization = await prisma.organization.create({
        data: { name: `${name}'s Organization`, slug },
      });
      if (dbUser) {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { organizationId: resolvedOrganization.id },
        });
      } else {
        dbUser = await prisma.user.create({
          data: {
            name,
            email: normalizedEmail,
            role: "admin",
            authId: session.user.id,
            organizationId: resolvedOrganization.id,
          },
          include: { organization: true },
        });
        resolvedOrganization = dbUser.organization!;
      }
    } catch {
      throw new Error("Could not provision account. Please try again.");
    }
  }

  const role = dbUser?.role ?? (isAllowedRole(metadata.role ?? "") ? (metadata.role as UserRole) : "analyst" as UserRole);
  const name = dbUser?.name ?? metadata.name ?? "User";
  const userId = dbUser?.id ?? metadata.prismaUserId ?? session.user.id;

  if (dbUser && !dbUser.authId) {
    try {
      await prisma.user.update({ where: { id: dbUser.id }, data: { authId: session.user.id } });
    } catch {
      // Ignore when Prisma is unavailable in edge runtime.
    }
  }

  const authSession: AuthSessionCookie = {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    userId,
    email: normalizedEmail,
    name,
    role,
    organizationId: resolvedOrganization.id,
  };

  await writeAuthSession(authSession);
  return {
    session: authSession,
    organization: { id: resolvedOrganization.id, name: resolvedOrganization.name, slug: resolvedOrganization.slug },
  };
}

export function isAllowedRole(role: string): role is UserRole {
  return ["admin", "analyst", "compliance_manager", "legal_counsel", "risk_officer", "executive"].includes(role);
}

interface ReconcileInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  organizationId: string;
  prismaUserId: string;
}

async function reconcileExistingSupabaseUserPassword(input: ReconcileInput) {
  if (process.env.NODE_ENV === "production" && process.env.AUTH_DEV_MODE !== "true") {
    return;
  }

  const supabase = createSupabaseAdmin();
  if (!supabase) return;

  const existing = await findSupabaseUserByEmail(supabase, input.email);
  if (!existing?.id) return;

  await supabase.auth.admin.updateUserById(existing.id, {
    password: input.password,
    email_confirm: true,
    user_metadata: {
      name: input.name,
      role: input.role,
      organizationId: input.organizationId,
      prismaUserId: input.prismaUserId,
    },
  });
}

async function findSupabaseUserByEmail(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdmin>>,
  email: string
) {
  let page = 1;
  const perPage = 200;
  while (page <= 10) {
    const result = await supabase.auth.admin.listUsers({ page, perPage });
    if (result.error) return null;
    const user = result.data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (result.data.users.length < perPage) break;
    page += 1;
  }
  return null;
}
