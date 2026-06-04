import type { Readable } from "node:stream";
import csv from "csv-parser";
import ExcelJS from "exceljs";
import { normalizePhoneNumber, type RecipientRow } from "@gestor/core";

const PHONE_HEADERS = [
  "phone", "telefono", "teléfono", "celular", "numero", "número",
  "whatsapp", "tel", "movil", "móvil",
];
const NAME_HEADERS = ["nombre", "name", "cliente", "contacto", "first_name"];

function norm(key: string): string {
  return key.trim().toLowerCase();
}

function pickField(headers: string[], candidates: string[]): number {
  return headers.findIndex((h) => candidates.includes(norm(h)));
}

function buildRow(phoneRaw: unknown, nameRaw: unknown): RecipientRow | null {
  const phone = normalizePhoneNumber(String(phoneRaw ?? "").trim());
  if (!phone) return null;
  const name = String(nameRaw ?? "").trim();
  return { phone, name: name || null };
}

/** CSV en streaming: una fila a la vez vía csv-parser (Transform en object mode). */
async function* parseCsv(stream: Readable): AsyncGenerator<RecipientRow> {
  const parser = stream.pipe(csv());
  for await (const record of parser as AsyncIterable<Record<string, string>>) {
    const keys = Object.keys(record);
    const phoneKey = keys.find((k) => PHONE_HEADERS.includes(norm(k)));
    const nameKey = keys.find((k) => NAME_HEADERS.includes(norm(k)));
    const target = phoneKey ?? keys[0];
    if (!target) continue;
    const row = buildRow(record[target], nameKey ? record[nameKey] : null);
    if (row) yield row;
  }
}

/** XLSX en streaming: WorkbookReader lee fila por fila sin abrir todo el archivo. */
async function* parseXlsx(stream: Readable): AsyncGenerator<RecipientRow> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(stream, {});
  let phoneIdx = -1;
  let nameIdx = -1;
  for await (const worksheet of workbook) {
    for await (const row of worksheet) {
      const values = row.values as unknown[]; // index 0 vacío, columnas desde 1
      if (row.number === 1) {
        const headers = values.map((v) => String(v ?? ""));
        phoneIdx = pickField(headers, PHONE_HEADERS);
        nameIdx = pickField(headers, NAME_HEADERS);
        if (phoneIdx === -1) phoneIdx = 1; // primera columna por defecto
        continue;
      }
      const built = buildRow(values[phoneIdx], nameIdx >= 0 ? values[nameIdx] : null);
      if (built) yield built;
    }
  }
}

/** Devuelve un generador asíncrono de destinatarios según el tipo de archivo. */
export function parseRecipients(
  stream: Readable,
  filename: string
): AsyncGenerator<RecipientRow> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) return parseCsv(stream);
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return parseXlsx(stream);
  throw new Error("Formato no soportado. Usá .csv o .xlsx");
}
