import type { WhatsAppSender } from "@/domain/types";
import { formatWhatsAppId } from "@/domain/phone";

interface WaClient {
  sendText: (chatId: string, content: string) => Promise<unknown>;
  isConnected: () => boolean | Promise<boolean>;
}

export class OpenWAWhatsAppSender implements WhatsAppSender {
  constructor(private readonly client: WaClient) {}

  isReady(): boolean {
    return true;
  }

  async sendText(phoneNumber: string, message: string): Promise<void> {
    const connected = await Promise.resolve(this.client.isConnected());
    if (!connected) {
      throw new Error("Cliente WhatsApp no conectado");
    }

    const chatId = formatWhatsAppId(phoneNumber);
    await this.client.sendText(chatId, message);
  }
}

export async function createOpenWAClient(): Promise<WaClient> {
  const { create } = await import("@open-wa/wa-automate");

  const sessionId = process.env.OPENWA_SESSION_ID ?? "gestor-campanas";
  const headless = process.env.OPENWA_HEADLESS !== "false";
  const multiDevice = process.env.OPENWA_MULTI_DEVICE !== "false";

  const client = await create({
    sessionId,
    multiDevice,
    headless,
    qrTimeout: 0,
    authTimeout: 0,
    disableSpins: true,
    logConsole: false,
    popup: !headless,
  });

  return {
    sendText: (chatId, content) =>
      (client.sendText as WaClient["sendText"])(chatId, content),
    isConnected: () => client.isConnected(),
  };
}
