import { NextResponse } from "next/server";
import {
  createOrganizationRepository,
  createUpdateSendRateSettingsUseCase,
} from "@/application/composition-root";
import { updateSendRateSchema } from "@/application/validators/update-settings";
import { formatSendRateLabel } from "@/domain/send-rate";

export const runtime = "nodejs";

export async function GET() {
  try {
    const repo = createOrganizationRepository();
    const org = await repo.getDefault();

    return NextResponse.json({
      sendRate: org.settings.sendRate,
      label: formatSendRateLabel(org.settings.sendRate),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = updateSendRateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const useCase = createUpdateSendRateSettingsUseCase();
    const sendRate = await useCase.execute(parsed.data);

    return NextResponse.json({
      success: true,
      sendRate,
      label: formatSendRateLabel(sendRate),
      restartRequired: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
