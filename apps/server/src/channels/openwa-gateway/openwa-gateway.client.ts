/**
 * Cliente REST del gateway OpenWA (https://github.com/rmyndharis/OpenWA).
 *
 * OJO: esto NO es el paquete npm "@open-wa/wa-automate" (deprecado, el que
 * usábamos antes embebido con Puppeteer). Es un servicio HTTP aparte,
 * autohospedado (ver el servicio "openwa" en docker-compose.yml). Este
 * cliente es un wrapper delgado sobre su API REST; no agrega dependencias
 * nuevas (usa el fetch nativo de Node 22).
 */

export type GatewaySessionStatus =
  | "created"
  | "initializing"
  | "qr_ready"
  | "authenticating"
  | "ready"
  | "disconnected"
  | "action_required"
  | "failed";

export interface GatewaySession {
  id: string;
  name: string;
  status: GatewaySessionStatus;
  phone?: string | null;
  pushName?: string | null;
  engineLoaded?: boolean;
}

export interface GatewayContact {
  id: string;
  name?: string | null;
  pushName?: string | null;
  number?: string | null;
  isMyContact?: boolean;
  isBlocked?: boolean;
  profilePicUrl?: string | null;
}

export interface GatewayQrResponse {
  qrCode: string;
  status: string;
}

export interface GatewayWebhook {
  id: string;
  sessionId: string;
  url: string;
  events: string[];
  active: boolean;
}

export interface CreateWebhookInput {
  url: string;
  events: string[];
  secret: string;
}

export interface SendTextInput {
  chatId: string;
  text: string;
}

export interface SendMediaInput {
  chatId: string;
  url?: string;
  base64?: string;
  mimetype?: string;
  filename?: string;
  caption?: string;
}

export interface SendResult {
  messageId: string;
  timestamp?: number;
}

export type MediaKind = "image" | "video" | "audio" | "document";

export interface OpenWaGatewayClientOptions {
  baseUrl: string;
  apiKey: string;
}

/** Error HTTP del gateway, con el status code para que el llamador decida cómo reaccionar. */
export class OpenWaGatewayError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "OpenWaGatewayError";
  }
}

export class OpenWaGatewayClient {
  constructor(private readonly options: OpenWaGatewayClientOptions) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.options.baseUrl}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.options.apiKey,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new OpenWaGatewayError(
        res.status,
        `OpenWA gateway ${method} ${path} -> ${res.status}: ${text || res.statusText}`
      );
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  listSessions(): Promise<GatewaySession[]> {
    return this.request<GatewaySession[]>("GET", "/sessions");
  }

  createSession(name: string): Promise<GatewaySession> {
    return this.request<GatewaySession>("POST", "/sessions", { name });
  }

  getSession(sessionId: string): Promise<GatewaySession> {
    return this.request<GatewaySession>("GET", `/sessions/${sessionId}`);
  }

  startSession(sessionId: string): Promise<void> {
    return this.request<void>("POST", `/sessions/${sessionId}/start`);
  }

  stopSession(sessionId: string): Promise<void> {
    return this.request<void>("POST", `/sessions/${sessionId}/stop`);
  }

  /** Docs: DELETE /sessions/:id → 204. Elimina la sesión del gateway. */
  deleteSession(sessionId: string): Promise<void> {
    return this.request<void>("DELETE", `/sessions/${sessionId}`);
  }

  /** Docs: POST /sessions/:id/pairing-code → código de 8 chars (alternativa al QR). */
  requestPairingCode(sessionId: string, phoneNumber: string): Promise<{ pairingCode: string; status: string }> {
    return this.request<{ pairingCode: string; status: string }>(
      "POST",
      `/sessions/${sessionId}/pairing-code`,
      { phoneNumber }
    );
  }

  /** Devuelve null si todavía no hay QR disponible (400 del gateway). */
  async getQr(sessionId: string): Promise<GatewayQrResponse | null> {
    try {
      return await this.request<GatewayQrResponse>("GET", `/sessions/${sessionId}/qr`);
    } catch (err) {
      if (err instanceof OpenWaGatewayError && err.status === 400) return null;
      throw err;
    }
  }

  listWebhooks(sessionId: string): Promise<GatewayWebhook[]> {
    return this.request<GatewayWebhook[]>("GET", `/sessions/${sessionId}/webhooks`);
  }

  /** Agenda de WhatsApp (paginada; max 1000 por página). */
  listContacts(
    sessionId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<GatewayContact[]> {
    const limit = opts?.limit ?? 1000;
    const offset = opts?.offset ?? 0;
    return this.request<GatewayContact[]>(
      "GET",
      `/sessions/${sessionId}/contacts?limit=${limit}&offset=${offset}`
    );
  }

  createWebhook(sessionId: string, input: CreateWebhookInput): Promise<GatewayWebhook> {
    return this.request<GatewayWebhook>("POST", `/sessions/${sessionId}/webhooks`, input);
  }

  sendText(sessionId: string, input: SendTextInput): Promise<SendResult> {
    return this.request<SendResult>("POST", `/sessions/${sessionId}/messages/send-text`, input);
  }

  sendMedia(sessionId: string, kind: MediaKind, input: SendMediaInput): Promise<SendResult> {
    return this.request<SendResult>(
      "POST",
      `/sessions/${sessionId}/messages/send-${kind}`,
      input
    );
  }
}
