/** Formato visual para Paraguay: DD/MM/YYYY HH:mm */
export function formatDateTimePy(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function formatDatePy(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/** Convierte ISO / Date a valor para input datetime-local */
export function toDatetimeLocalValue(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  date.setSeconds(0, 0);
  return date.toISOString().slice(0, 16);
}

export function defaultScheduledAtLocal(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  return toDatetimeLocalValue(date);
}

/** Parsea datetime-local (YYYY-MM-DDTHH:mm) a Date */
export function fromDatetimeLocalValue(value: string): Date {
  return new Date(value);
}
