import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ assignmentId: string }> },
): Promise<NextResponse<{ ok: true } | { error: string }>> {
  const { assignmentId: raw } = await context.params;
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid assignment id" }, { status: 400 });
  }

  const existing = await prisma.shiftAssignment.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.shiftAssignment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
