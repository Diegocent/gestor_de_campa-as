import type { IOmnichannelAck } from "../../domain/channels/omnichannel.js";
import type { InboxMessageRepository, RealtimePublisher } from "../ports.js";

/** Aplica un acuse de recibo (sent/delivered/read/failed) a un mensaje saliente. */
export class RegisterAckUseCase {
  constructor(
    private readonly messages: InboxMessageRepository,
    private readonly realtime: RealtimePublisher
  ) {}

  async execute(organizationId: string, ack: IOmnichannelAck): Promise<void> {
    await this.messages.updateStatusByProviderId(ack.providerMessageId, ack.status);
    this.realtime.emitAck(organizationId, ack);
  }
}
