import type { WhatsAppSender } from "@/domain/types";
import { createOpenWAClient, OpenWAWhatsAppSender } from "./openwa-client";
import { createOpenWAGatewaySender } from "./openwa-gateway-client";

export type OpenWAMode = "gateway" | "embedded";

export function getOpenWAMode(): OpenWAMode {
  const mode = process.env.OPENWA_MODE ?? "gateway";
  if (mode !== "gateway" && mode !== "embedded") {
    throw new Error(`OPENWA_MODE inválido: "${mode}". Usá "gateway" o "embedded".`);
  }
  return mode;
}

export async function createWhatsAppSender(): Promise<WhatsAppSender> {
  const mode = getOpenWAMode();

  if (mode === "gateway") {
    console.log("[worker] Modo OpenWA: gateway (REST API externa)");
    return createOpenWAGatewaySender();
  }

  console.log("[worker] Modo OpenWA: embedded (@open-wa/wa-automate)");
  const client = await createOpenWAClient();
  return new OpenWAWhatsAppSender(client);
}
