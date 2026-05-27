import { BullMQJobQueue } from "@/infrastructure/queue/bullmq";
import {
  DrizzleMessageRepository,
  DrizzleOrganizationRepository,
} from "@/infrastructure/database/repositories";
import { ScheduleCampaignUseCase } from "@/application/use-cases/schedule-campaign";
import {
  DeleteCampaignUseCase,
  UpdateCampaignUseCase,
} from "@/application/use-cases/manage-campaign";
import { UpdateSendRateSettingsUseCase } from "@/application/use-cases/manage-settings";

function createJobQueue() {
  return new BullMQJobQueue();
}

function createMessageRepository() {
  return new DrizzleMessageRepository();
}

export function createScheduleCampaignUseCase() {
  return new ScheduleCampaignUseCase(
    new DrizzleOrganizationRepository(),
    createMessageRepository(),
    createJobQueue()
  );
}

export function createUpdateCampaignUseCase() {
  return new UpdateCampaignUseCase(createMessageRepository(), createJobQueue());
}

export function createDeleteCampaignUseCase() {
  return new DeleteCampaignUseCase(createMessageRepository(), createJobQueue());
}

export function createOrganizationRepository() {
  return new DrizzleOrganizationRepository();
}

export function createUpdateSendRateSettingsUseCase() {
  return new UpdateSendRateSettingsUseCase(new DrizzleOrganizationRepository());
}

export { createMessageRepository };
