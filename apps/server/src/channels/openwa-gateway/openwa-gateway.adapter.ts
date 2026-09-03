import type {
  AckHandler,
  ChannelConnectionState,
  ConnectionStateHandler,
  IChannelAdapter,
  InboundMessageHandler,
  SendOutboundCommand,
} from "@gestor/core";
import {
  OpenWaGatewayClient,
  OpenWaGatewayError,
  type GatewaySessionStatus,
  type MediaKind,
} from "./openwa-gateway.client.js";
import {
  toOmnichannelAck,
  toOmnichannelMessage,
  type GatewayAckData,
  type GatewayMessage,
} from "./openwa-gateway.mapper.js";

export interface OpenWaGatewayAdapterOptions {
  baseUrl: string;
  apiKey: string;
  sessionName: string;
  webhookUrl: string;
  webhookSecret: string;
}

const SUBSCRIBED_EVENTS = [
  "message.received",
  "message.sent",
  "message.ack",
  "message.failed",
  "session.status",
  "session.qr",
  "session.authenticated",
  "session.disconnected",
] as const;

/** Intervalo de polling de respaldo (docs OpenWA: QR rota ~cada 20s). */
const POLL_INTERVAL_MS = 3000;

function mapGatewayStatus(status: GatewaySessionStatus): ChannelConnectionState {
  switch (status) {
    case "created":
    case "initializing":
      return "initializing";
    case "qr_ready":
      return "qr_required";
    case "authenticating":
      return "authenticated";
    case "ready":
      return "connected";
    case "disconnected":
      return "disconnected";
    case "action_required":
    case "failed":
      return "error";
    default:
      return "initializing";
  }
}

/**
 * Adaptador del gateway OpenWA (https://github.com/rmyndharis/OpenWA), un
 * servicio self-hosted aparte (ver docker-compose.yml). Habla con él por REST
 * y recibe eventos en vivo por webhook (ver http/routes/openwa-webhook.routes.ts),
 * con un polling de respaldo por si un webhook se pierde.
 *
 * Flujo oficial (docs): create session → start → GET /qr (PNG data URL) → scan.
 * El QR es un data URL (`data:image/png;base64,…`) y se regenera con frecuencia;
 * hay que refrescarlo en cada poll mientras el estado sea `qr_ready`.
 */
export class OpenWaGatewayAdapter implements IChannelAdapter {
  readonly channelType = "whatsapp_unofficial" as const;
  readonly sessionName: string;

  private readonly client: OpenWaGatewayClient;
  /** UUID de la sesión en el gateway (path param de la API; distinto del name). */
  private sessionId: string | null = null;
  private qr: string | null = null;
  private connected = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private messageHandlers: InboundMessageHandler[] = [];
  private ackHandlers: AckHandler[] = [];
  private stateHandlers: ConnectionStateHandler[] = [];

  constructor(private readonly options: OpenWaGatewayAdapterOptions) {
    this.sessionName = options.sessionName;
    this.client = new OpenWaGatewayClient({ baseUrl: options.baseUrl, apiKey: options.apiKey });
  }

  /** UUID que OpenWA usa en webhooks (`envelope.sessionId`) y en `/api/sessions/:id`. */
  get gatewaySessionId(): string | null {
    return this.sessionId;
  }

  async start(): Promise<void> {
    this.setState("initializing");

    const sessions = await this.client.listSessions();
    let session = sessions.find((s) => s.name === this.options.sessionName);
    if (!session) {
      session = await this.client.createSession(this.options.sessionName);
    }
    this.sessionId = session.id;

    await this.ensureWebhook(session.id);

    // Docs: start cuando la sesión aún no está lista. Si ya está en qr_ready /
    // ready / authenticating, no re-start (el engine ya corre).
    const needsStart =
      session.status === "created" ||
      session.status === "disconnected" ||
      session.status === "failed" ||
      session.status === "action_required";

    if (needsStart) {
      await this.client.startSession(session.id).catch((err) => {
        // AUTO_START_SESSIONS=true puede estar iniciando en paralelo.
        console.warn("[openwa-gateway] start() no crítico:", (err as Error).message);
      });
    }

    await this.applyStatus(session.status);
    this.startPolling();
  }

  async stop(): Promise<void> {
    // Solo corta el polling local. El gateway sigue vivo si reiniciamos el
    // proceso; destruir la sesión en OpenWA es `destroy()`.
    this.stopPolling();
  }

  /**
   * Elimina la sesión en OpenWA (stop + DELETE /sessions/:id) y corta el
   * polling. Usar cuando el usuario borra el canal desde la UI.
   */
  async destroy(): Promise<void> {
    this.stopPolling();
    this.connected = false;
    this.qr = null;
    const id = this.sessionId;
    this.sessionId = null;
    if (!id) return;
    await this.client.stopSession(id).catch(() => undefined);
    await this.client.deleteSession(id).catch((err) => {
      // 404 = ya no existe; el resto lo logueamos vía throw al llamador
      if (err instanceof OpenWaGatewayError && err.status === 404) return;
      throw err;
    });
  }

  async sendMessage(command: SendOutboundCommand): Promise<{ providerMessageId: string }> {
    if (!this.sessionId) throw new Error("OpenWA gateway no está inicializado");

    if (command.type === "text") {
      const result = await this.client.sendText(this.sessionId, {
        chatId: command.conversationRef,
        text: command.text ?? "",
      });
      return { providerMessageId: result.messageId };
    }

    if (command.media?.url || command.media?.base64) {
      const result = await this.client.sendMedia(this.sessionId, command.type as MediaKind, {
        chatId: command.conversationRef,
        url: command.media.url,
        base64: command.media.base64,
        mimetype: command.media.mimeType,
        filename: command.media.filename,
        caption: command.media.caption ?? command.text,
      });
      return { providerMessageId: result.messageId };
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

  /**
   * Trae contactos de la agenda WhatsApp (isMyContact) para sincronizar nombres.
   * Devuelve [] si la sesión aún no está lista.
   */
  async fetchAgendaContacts(): Promise<
    Array<{
      externalId: string;
      phone: string;
      name: string | null;
      avatarUrl: string | null;
    }>
  > {
    if (!this.sessionId || !this.connected) return [];
    const out: Array<{
      externalId: string;
      phone: string;
      name: string | null;
      avatarUrl: string | null;
    }> = [];
    let offset = 0;
    const limit = 1000;
    for (;;) {
      const batch = await this.client.listContacts(this.sessionId, { limit, offset });
      for (const c of batch) {
        if (c.isMyContact === false) continue;
        const phone =
          (c.number ?? "").replace(/\D/g, "") ||
          c.id.replace(/@.*$/, "").replace(/\D/g, "");
        if (!phone) continue;
        const name = (c.name ?? c.pushName ?? "").trim() || null;
        if (!name) continue;
        out.push({
          externalId: c.id.includes("@") ? c.id : `${phone}@c.us`,
          phone: phone.slice(0, 64),
          name: name.slice(0, 255),
          avatarUrl: c.profilePicUrl ?? null,
        });
      }
      if (batch.length < limit) break;
      offset += limit;
      if (offset > 50_000) break;
    }
    return out;
  }

  isReady(): boolean {
    return this.connected;
  }

  /** Reinicia la sesión en el gateway para forzar un QR nuevo (stop → start). */
  async restartForQr(): Promise<void> {
    if (!this.sessionId) throw new Error("Sesión no inicializada");
    this.connected = false;
    this.qr = null;
    this.setState("initializing");
    await this.client.stopSession(this.sessionId).catch(() => undefined);
    await this.client.startSession(this.sessionId);
    this.startPolling();
  }

  /**
   * Alternativa al QR (docs OpenWA): código de vinculación por número.
   * `phoneNumber` en E.164 sin "+" (ej. 595981234567).
   */
  async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.sessionId) throw new Error("Sesión no inicializada");
    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length < 8) throw new Error("Número inválido");
    const result = await this.client.requestPairingCode(this.sessionId, digits);
    this.startPolling();
    return result.pairingCode;
  }

  /**
   * Punto de entrada de los eventos que llegan por webhook (ver
   * openwa-webhook.routes.ts). Payload de session.qr según docs:
   * `{ sessionId, qr }` donde `qr` es PNG data URL.
   */
  handleWebhookEvent(event: string, sessionId: string, data: unknown): void {
    if (this.sessionId && sessionId !== this.sessionId) return;

    switch (event) {
      case "message.received":
      case "message.sent":
        this.emitMessage(data as GatewayMessage);
        return;
      case "message.ack":
      case "message.failed":
        this.emitAck(data as GatewayAckData);
        return;
      case "session.qr": {
        const payload = data as { qr?: string; qrCode?: string };
        const next = payload.qr ?? payload.qrCode ?? null;
        if (next) this.qr = next;
        this.connected = false;
        this.setState("qr_required");
        this.startPolling();
        return;
      }
      case "session.status": {
        const payload = data as { status: GatewaySessionStatus };
        void this.applyStatus(payload.status);
        return;
      }
      case "session.authenticated":
        this.setState("authenticated");
        return;
      case "session.disconnected":
        this.connected = false;
        this.qr = null;
        this.setState("disconnected");
        this.startPolling();
        return;
      default:
        return;
    }
  }

  private async ensureWebhook(sessionId: string): Promise<void> {
    const webhooks = await this.client.listWebhooks(sessionId);
    if (webhooks.some((w) => w.url === this.options.webhookUrl)) return;
    await this.client.createWebhook(sessionId, {
      url: this.options.webhookUrl,
      events: [...SUBSCRIBED_EVENTS],
      secret: this.options.webhookSecret,
    });
  }

  private async applyStatus(status: GatewaySessionStatus): Promise<void> {
    const mapped = mapGatewayStatus(status);

    // Docs: mientras status === qr_ready, GET /qr devuelve el PNG vigente.
    // El QR rota; hay que re-fetch siempre (no cachear el primero).
    if (mapped === "qr_required" && this.sessionId) {
      const qr = await this.client.getQr(this.sessionId).catch(() => null);
      if (qr?.qrCode) this.qr = qr.qrCode;
    }

    if (mapped === "connected") {
      this.qr = null;
      this.connected = true;
      this.stopPolling();
    } else if (mapped === "disconnected" || mapped === "error") {
      this.connected = false;
      this.startPolling();
    } else {
      this.connected = false;
      this.startPolling();
    }

    this.setState(mapped);
  }

  /** Polling de respaldo: sigue hasta conectar (los webhooks a veces fallan). */
  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      void (async () => {
        if (!this.sessionId) return;
        if (this.connected) {
          this.stopPolling();
          return;
        }
        try {
          const session = await this.client.getSession(this.sessionId);
          await this.applyStatus(session.status);
        } catch {
          // Error transitorio de red hacia el gateway; el próximo tick reintenta.
        }
      })();
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private emitMessage(raw: GatewayMessage): void {
    const normalized = toOmnichannelMessage(raw, this.sessionName);
    for (const handler of this.messageHandlers) void handler(normalized);
  }

  private emitAck(raw: GatewayAckData): void {
    const ack = toOmnichannelAck(raw);
    for (const handler of this.ackHandlers) void handler(ack);
  }

  private setState(state: ChannelConnectionState): void {
    for (const handler of this.stateHandlers) handler(state);
  }
}
