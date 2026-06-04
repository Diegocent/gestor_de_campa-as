// Domain — Channel Adapter Pattern (contrato omnichannel)
export * from "./domain/channels/omnichannel.js";
export * from "./domain/channels/adapter.js";
export * from "./domain/phone.js";

// Domain — entidades del inbox / mini-CRM
export * from "./domain/inbox/entities.js";

// Domain — campañas masivas
export * from "./domain/campaigns/entities.js";
export * from "./domain/campaigns/personalization.js";

// Application — puertos
export * from "./application/ports.js";

// Application — casos de uso
export { IngestInboundMessageUseCase } from "./application/use-cases/ingest-inbound-message.js";
export { RegisterAckUseCase } from "./application/use-cases/register-ack.js";
export {
  SendAgentMessageUseCase,
  type SendAgentMessageInput,
} from "./application/use-cases/send-agent-message.js";
export {
  LoginUseCase,
  RefreshTokenUseCase,
  type AuthResult,
} from "./application/use-cases/auth.js";
export { ProcessCampaignMessageUseCase } from "./application/use-cases/process-campaign-message.js";
