import { withAuth, json } from "@/lib/api/handler";
import { ApiValidationError } from "@/lib/auth/rbac";
import { documentListSchema } from "@/lib/api/schemas";
import { prisma } from "@/lib/db";
import { assertIncidentInOrganization, assertOrganizationAccess } from "@/lib/auth/tenant";

export const GET = withAuth("incidents:read", async (request, { user }) => {
  const url = new URL(request.url);
  const parsed = documentListSchema.safeParse({
    incidentId: url.searchParams.get("incidentId") ?? undefined,
    organizationId: url.searchParams.get("organizationId") ?? undefined,
  });

  if (!parsed.success) {
    throw new ApiValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  if (parsed.data.organizationId) {
    await assertOrganizationAccess(parsed.data.organizationId, user.organizationId, user.role);
  }
  if (parsed.data.incidentId) {
    await assertIncidentInOrganization(parsed.data.incidentId, parsed.data.organizationId ?? user.organizationId);
  }

  const documents = await prisma.document.findMany({
    where: {
      ...(parsed.data.incidentId ? { incidentId: parsed.data.incidentId } : {}),
      organizationId: parsed.data.organizationId ?? user.organizationId,
    },
    orderBy: { createdAt: "desc" },
    include: {
      chunks: { select: { id: true } },
      uploader: { select: { id: true, name: true, email: true } },
    },
    take: 200,
  });

  await prisma.auditLog.create({
    data: {
      incidentId: parsed.data.incidentId,
      organizationId: parsed.data.organizationId,
      actorType: "user",
      actorId: user.id,
      action: "documents_list_viewed",
      detailsJson: { count: documents.length },
    },
  });

  return json({
    documents: documents.map((doc: (typeof documents)[number]) => ({
      id: doc.id,
      name: doc.name,
      mimeType: doc.mimeType,
      type: doc.type,
      sizeBytes: doc.sizeBytes,
      publicUrl: doc.publicUrl,
      createdAt: doc.createdAt,
      chunkCount: doc.chunks.length,
      uploadedBy: doc.uploader,
    })),
  });
});
