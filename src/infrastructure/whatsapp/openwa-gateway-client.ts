import type { WhatsAppSender } from "@/domain/types";
import { formatWhatsAppId } from "@/domain/phone";

interface GatewayConfig {
  baseUrl: string;
  apiKey: string;
  sessionName: string;
}

interface OpenWASession {
  id: string;
  name: string;
}

function getGatewayConfig(): GatewayConfig {
  const baseUrl = process.env.OPENWA_GATEWAY_URL ?? "http://localhost:2785";
  const apiKey = process.env.OPENWA_API_KEY;
  const sessionName = process.env.OPENWA_SESSION_ID ?? "gestor-campanas";

  if (!apiKey) {
    throw new Error("OPENWA_API_KEY es obligatorio en modo gateway");
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey, sessionName };
}

async function parseSessions(response: Response): Promise<OpenWASession[]> {
  const payload = await response.json();
  if (Array.isArray(payload)) return payload as OpenWASession[];
  if (payload && Array.isArray((payload as { data?: OpenWASession[] }).data)) {
    return (payload as { data: OpenWASession[] }).data;
  }
  return [];
}

async function parseSession(response: Response): Promise<OpenWASession | null> {
  const payload = await response.json();
  if (payload && typeof payload === "object" && "id" in payload) {
    return payload as OpenWASession;
  }
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: OpenWASession }).data ?? null;
  }
  return null;
}

export class OpenWAGatewaySender implements WhatsAppSender {
  private ready = false;
  private resolvedSessionId: string | null = null;

  constructor(private readonly config: GatewayConfig = getGatewayConfig()) {}

  isReady(): boolean {
    return this.ready;
  }

  private headers(): Record<string, string> {
    return { "X-API-Key": this.config.apiKey };
  }

  private async resolveSessionId(): Promise<string> {
    const { baseUrl, apiKey, sessionName } = this.config;

    const listResponse = await fetch(`${baseUrl}/api/sessions`, {
      headers: this.headers(),
    });

    if (listResponse.ok) {
      const sessions = await parseSessions(listResponse);
      const existing = sessions?.find((s) => s.name === sessionName);
      if (existing?.id) return existing.id;
    }

    const createResponse = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ name: sessionName }),
    });

    if (createResponse.ok) {
      const created = await parseSession(createResponse);
      if (created?.id) return created.id;
    }

    if (createResponse.status === 409) {
      const retryList = await fetch(`${baseUrl}/api/sessions`, {
        headers: this.headers(),
      });
      if (retryList.ok) {
        const sessions = await parseSessions(retryList);
        const existing = sessions?.find((s) => s.name === sessionName);
        if (existing?.id) return existing.id;
      }
    }

    throw new Error(
      `No se pudo resolver sesión OpenWA "${sessionName}" (${createResponse.status})`
    );
  }

  async connect(): Promise<void> {
    const { baseUrl, sessionName } = this.config;
    const sessionId = await this.resolveSessionId();
    this.resolvedSessionId = sessionId;

    const autoStart = process.env.OPENWA_AUTO_START === "true";

    if (autoStart) {
      const startResponse = await fetch(`${baseUrl}/api/sessions/${sessionId}/start`, {
        method: "POST",
        headers: this.headers(),
      });

      const startOk =
        startResponse.ok ||
        startResponse.status === 409 ||
        startResponse.status === 400;

      if (!startOk) {
        throw new Error(`No se pudo iniciar sesión OpenWA: ${startResponse.status}`);
      }
    }

    this.ready = true;
    console.log(
      `[openwa-gateway] Sesión "${sessionName}" (${sessionId}) registrada. Dashboard: http://localhost:2886`
    );
    if (!autoStart) {
      console.log(
        "[openwa-gateway] Conectá WhatsApp desde el dashboard (Reconnect / QR). El worker no inicia sesión solo."
      );
    }
  }

  async sendText(phoneNumber: string, message: string): Promise<void> {
    if (!this.ready || !this.resolvedSessionId) {
      throw new Error("Gateway OpenWA no conectado. Ejecutá connect() primero.");
    }

    const { baseUrl } = this.config;
    const chatId = formatWhatsAppId(phoneNumber);

    const response = await fetch(
      `${baseUrl}/api/sessions/${this.resolvedSessionId}/messages/send-text`,
      {
        method: "POST",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, text: message }),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenWA Gateway error ${response.status}: ${body}`);
    }
  }
}

export async function createOpenWAGatewaySender(): Promise<OpenWAGatewaySender> {
  const sender = new OpenWAGatewaySender();
  await sender.connect();
  return sender;
}
