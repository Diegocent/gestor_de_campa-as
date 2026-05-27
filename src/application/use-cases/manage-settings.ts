import type { OrganizationRepository } from "@/domain/types";
import {
  normalizeSendRateSettings,
  type SendRateSettings,
} from "@/domain/send-rate";

export class UpdateSendRateSettingsUseCase {
  constructor(private readonly organizations: OrganizationRepository) {}

  async execute(input: SendRateSettings): Promise<SendRateSettings> {
    const organization = await this.organizations.getDefault();
    const sendRate = normalizeSendRateSettings(input);

    const updated = await this.organizations.updateSettings(organization.slug, {
      sendRate,
    });

    return updated.settings.sendRate;
  }
}
