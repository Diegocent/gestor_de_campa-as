import type { Client, ConfigObject } from "@open-wa/wa-automate";
import type {
  AckHandler,
  ChannelConnectionState,
  ConnectionStateHandler,
  IChannelAdapter,
  InboundMessageHandler,
  SendOutboundCommand,
} from "@gestor/core";
import {
  toOmnichannelAck,
  toOmnichannelMessage,
  type RawWaMessage,
} from "./openwa.mapper.js";

export interface OpenWaAdapterOptions {
  sessionId: string;
  multiDevice: boolean;
  headless: boolean;
}

/**
 * Adaptador de @open-wa/wa-automate. Es el proveedor de eventos: traduce
 * onMessage/onAck nativos al contrato omnichannel y los empuja al sistema.
 * Migrar a Cloud API = escribir otro adaptador con esta misma interfaz.
 */
export class OpenWaAdapter implements IChannelAdapter {
  readonly channelType = "whatsapp_unofficial" as const;

  private client: Client | null = null;
  private qr: string | null = null;
  private connected = false;

  private messageHandlers: InboundMessageHandler[] = [];
  private ackHandlers: AckHandler[] = [];
  private stateHandlers: ConnectionStateHandler[] = [];

  constructor(private readonly options: OpenWaAdapterOptions) {}

  async start(): Promise<void> {
    this.setState("initializing");
    const wa = await import("@open-wa/wa-automate");

    wa.ev.on("qr.**", (qrcode: string) => {
      this.qr = qrcode;
      this.setState("qr_required");
    });

    const config = {
      sessionId: this.options.sessionId,
      multiDevice: this.options.multiDevice,
      headless: this.options.headless,
      qrTimeout: 0,
      authTimeout: 0,
      blockCrashLogs: true,
      disableSpins: true,
      logConsole: false,
      popup: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    } as ConfigObject;

    this.client = await wa.create(config);
    this.connected = true;
    this.qr = null;
    this.setState("connected");

    this.client.onMessage((message) => {
      this.emitMessage(message as unknown as RawWaMessage);
    });

    this.client.onAck((message) => {
      const ack = toOmnichannelAck(message as unknown as RawWaMessage);
      for (const handler of this.ackHandlers) void handler(ack);
    });

    this.client.onStateChanged((state: string) => {
      if (state === "CONNECTED") this.setState("connected");
      else if (state === "UNPAIRED" || state === "CONFLICT") this.setState("disconnected");
    });
  }

  private emitMessage(message: RawWaMessage): void {
    const normalized = toOmnichannelMessage(message);
    for (const handler of this.messageHandlers) void handler(normalized);
  }

  async stop(): Promise<void> {
    await this.client?.kill();
    this.client = null;
    this.connected = false;
    this.setState("disconnected");
  }

  async sendMessage(command: SendOutboundCommand): Promise<{ providerMessageId: string }> {
    if (!this.client) throw new Error("OpenWA no está conectado");
    if (command.type === "text") {
      const id = await this.client.sendText(command.conversationRef, command.text ?? "");
      return { providerMessageId: String(id) };
    }
    if (command.media?.url) {
      const id = await this.client.sendFileFromUrl(
        command.conversationRef,
        command.media.url,
        command.media.filename ?? "file",
        command.media.caption ?? ""
      );
      return { providerMessageId: String(id) };
    }
    throw new Error(`Tipo de mensaje no soportado: ${command.type}`);
  }

  onMessage(handler: InboundMessageHandler): void {
    this.messageHandlers.push(handler);
  }

  onAck(handler: AckHandler): void {
    this.ackHandlers.push(handler);
  }

  onConnectionState(handler: ConnectionStateHandler): void {
    this.stateHandlers.push(handler);
  }

  getQr(): string | null {
    return this.qr;
  }

  isReady(): boolean {
    return this.connected;
  }

  private setState(state: ChannelConnectionState): void {
    for (const handler of this.stateHandlers) handler(state);
  }
}
