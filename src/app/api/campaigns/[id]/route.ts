import { NextResponse } from "next/server";
import {
  createDeleteCampaignUseCase,
  createMessageRepository,
  createUpdateCampaignUseCase,
} from "@/application/composition-root";
import { updateCampaignSchema } from "@/application/validators/update-campaign";
import { isCampaignEditable } from "@/domain/campaign-rules";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const repo = createMessageRepository();
    const [campaign, messages] = await Promise.all([
      repo.getCampaignById(id),
      repo.getMessagesByCampaign(id),
    ]);

    if (!campaign) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      campaign,
      messages,
      editable: isCampaignEditable(campaign, messages),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, messageBody, recipients, scheduledAt } = parsed.data;
    const useCase = createUpdateCampaignUseCase();
    const result = await useCase.execute({
      campaignId: id,
      title,
      messageBody,
      recipients,
      scheduledAt: new Date(scheduledAt),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    const status = message.includes("no encontrada") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const useCase = createDeleteCampaignUseCase();
    await useCase.execute(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    const status = message.includes("no encontrada") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
