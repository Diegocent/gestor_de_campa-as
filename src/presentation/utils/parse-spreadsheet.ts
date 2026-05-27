import * as XLSX from "xlsx";
import { normalizePhoneNumber } from "@/domain/phone";
import type { CampaignRecipient } from "@/domain/types";

const PHONE_HEADERS = [
  "telefono",
  "teléfono",
  "celular",
  "movil",
  "móvil",
  "phone",
  "numero",
  "número",
  "whatsapp",
  "cel",
];

const NAME_HEADERS = ["nombre", "name", "cliente", "contacto", "destinatario"];

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  return headers.findIndex((header) => candidates.includes(header));
}

export function parseSpreadsheetBuffer(buffer: ArrayBuffer): CampaignRecipient[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("El archivo no contiene hojas de cálculo");
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
  });

  if (rows.length === 0) {
    throw new Error("El archivo está vacío");
  }

  const headers = rows[0].map(normalizeHeader);
  const phoneIdx = findColumnIndex(headers, PHONE_HEADERS);
  const nameIdx = findColumnIndex(headers, NAME_HEADERS);

  if (phoneIdx === -1) {
    throw new Error(
      "No se encontró columna de teléfono. Usá encabezados como: telefono, celular o phone"
    );
  }

  if (nameIdx === -1) {
    throw new Error(
      "No se encontró columna de nombre. Usá encabezados como: nombre, name o cliente"
    );
  }

  const recipients: CampaignRecipient[] = [];

  for (const row of rows.slice(1)) {
    const rawPhone = String(row[phoneIdx] ?? "").trim();
    const rawName = String(row[nameIdx] ?? "").trim();

    if (!rawPhone) continue;

    const phoneNumber = normalizePhoneNumber(rawPhone);
    if (!phoneNumber) continue;

    recipients.push({
      phoneNumber,
      recipientName: rawName || undefined,
    });
  }

  if (recipients.length === 0) {
    throw new Error("No se encontraron filas válidas con teléfono y nombre");
  }

  return recipients;
}

export async function parseSpreadsheetFile(file: File): Promise<CampaignRecipient[]> {
  const buffer = await file.arrayBuffer();
  return parseSpreadsheetBuffer(buffer);
}
