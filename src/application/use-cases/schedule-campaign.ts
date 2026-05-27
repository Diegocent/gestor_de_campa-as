import type {

  JobQueue,

  MessageRepository,

  OrganizationRepository,

  ScheduleCampaignInput,

  ScheduleCampaignResult,

  SendMessagePayload,

} from "@/domain/types";

import { prepareCampaignMessages } from "@/domain/recipients";



export class ScheduleCampaignUseCase {

  constructor(

    private readonly organizations: OrganizationRepository,

    private readonly messages: MessageRepository,

    private readonly queue: JobQueue

  ) {}



  async execute(input: ScheduleCampaignInput): Promise<ScheduleCampaignResult> {

    const organization = await this.organizations.findBySlug(input.organizationSlug);

    if (!organization?.isActive) {

      throw new Error("Organización no encontrada o inactiva");

    }



    const messages = prepareCampaignMessages(input.messageBody, input.recipients);



    if (input.scheduledAt.getTime() <= Date.now()) {

      throw new Error("La fecha programada debe ser futura");

    }



    const result = await this.messages.createCampaignWithMessages({

      ...input,

      organizationId: organization.id,

      messages,

    });



    const campaignMessages = await this.messages.getMessagesByCampaign(result.campaignId);



    for (const message of campaignMessages) {

      const jobId = await this.queue.enqueueDelayedSend(

        {

          messageId: message.id,

          phoneNumber: message.phoneNumber,

          messageBody: message.messageBody,

        },

        message.scheduledAt

      );



      await this.messages.updateMessageStatus(message.id, "queued", {

        bullJobId: jobId,

      });

    }



    return result;

  }

}



export class ProcessSendMessageUseCase {

  constructor(

    private readonly messages: MessageRepository,

    private readonly whatsapp: { sendText(phone: string, body: string): Promise<void> }

  ) {}



  async execute(payload: SendMessagePayload): Promise<void> {

    const existing = await this.messages.getMessageById(payload.messageId);

    if (!existing) {

      throw new Error(`Mensaje ${payload.messageId} no encontrado`);

    }



    await this.messages.updateMessageStatus(payload.messageId, "processing", {

      attempts: existing.attempts + 1,

    });



    try {

      await this.whatsapp.sendText(payload.phoneNumber, payload.messageBody);

      await this.messages.updateMessageStatus(payload.messageId, "sent", {

        sentAt: new Date(),

      });



      await this.messages.incrementCampaignCounters(existing.campaignId, { sent: 1 });

      await this.messages.refreshCampaignStatus(existing.campaignId);

    } catch (error) {

      const errorMessage = error instanceof Error ? error.message : "Error desconocido";

      await this.messages.updateMessageStatus(payload.messageId, "failed", {

        lastError: errorMessage,

      });



      await this.messages.incrementCampaignCounters(existing.campaignId, { failed: 1 });

      await this.messages.refreshCampaignStatus(existing.campaignId);



      throw error;

    }

  }

}

