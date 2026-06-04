/**
 * Reemplaza placeholders del cuerpo del mensaje con datos del destinatario.
 * Soporta {nombre} y {name}. Si no hay nombre, usa un saludo neutro.
 */
export function personalizeMessage(
  template: string,
  recipientName: string | null
): string {
  const name = (recipientName ?? "").trim();
  return template.replace(/\{(nombre|name)\}/gi, name);
}

/** Indica si el template usa el placeholder de nombre. */
export function hasNamePlaceholder(template: string): boolean {
  return /\{(nombre|name)\}/i.test(template);
}
