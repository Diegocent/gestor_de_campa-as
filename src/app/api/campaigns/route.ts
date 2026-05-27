import { NextResponse } from "next/server";
import {
  createMessageRepository,
  createOrganizationRepository,
  createScheduleCampaignUseCase,
} from "@/application/composition-root";
import { scheduleCampaignSchema } from "@/application/validators/schedule-campaign";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = scheduleCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, messageBody, recipients, scheduledAt, organizationSlug } = parsed.data;

    const useCase = createScheduleCampaignUseCase();
    const result = await useCase.execute({
      title,
      messageBody,
      recipients,
      scheduledAt: new Date(scheduledAt),
      organizationSlug: organizationSlug ?? process.env.DEFAULT_ORG_SLUG ?? "default",
    });

    return NextResponse.json(
      {
        success: true,
        campaignId: result.campaignId,
        scheduledCount: result.scheduledCount,
        scheduledAt: result.scheduledAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { DEFAULT_CAMPAIGNS_PAGE_SIZE } from "@/domain/campaign-pagination";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? 1);
    const pageSize = Number(searchParams.get("pageSize") ?? DEFAULT_CAMPAIGNS_PAGE_SIZE);

    const orgRepo = createOrganizationRepository();
    const messageRepo = createMessageRepository();
    const org = await orgRepo.getDefault();
    const result = await messageRepo.listCampaignsPage(org.id, page, pageSize);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
