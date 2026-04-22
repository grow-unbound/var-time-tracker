import { NextResponse } from "next/server";

import { parseJsonBody } from "@/lib/api-validation";
import { patchProjectBodySchema } from "@/lib/project-api-validation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const AUDIT = "PROJMGMT-001";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<{ ok: true } | { error: string }>> {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseJsonBody(patchProjectBodySchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const { name, colorKey } = parsed.data;
  if (name === undefined && colorKey === undefined) {
    return NextResponse.json(
      { error: "At least one of name or colorKey is required" },
      { status: 400 },
    );
  }

  const existing = await prisma.project.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.project.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(colorKey !== undefined ? { colorKey } : {}),
      updatedById: AUDIT,
    },
  });

  return NextResponse.json({ ok: true });
}
