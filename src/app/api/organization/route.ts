import { NextResponse } from "next/server";
import { createOrganizationRepository } from "@/application/composition-root";

export const runtime = "nodejs";

export async function GET() {
  try {
    const repo = createOrganizationRepository();
    const org = await repo.getDefault();
    return NextResponse.json(org);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
