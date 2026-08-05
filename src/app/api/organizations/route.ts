import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/organizations — lista organizações habilitadas (tela de login)
export async function GET() {
  const organizations = await prisma.organization.findMany({
    where: { enabled: true },
    select: { id: true, slug: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ organizations });
}
