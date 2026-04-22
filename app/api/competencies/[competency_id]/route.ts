import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ competency_id: string }> },
): Promise<NextResponse<{ ok: true } | { error: string }>> {
  const { competency_id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid competency id" }, { status: 400 });
  }

  const deleted = await prisma.employeeCompetency.deleteMany({
    where: { id },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
