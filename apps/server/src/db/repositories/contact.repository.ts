import type {
  Contact,
  ContactRepository,
  IOmnichannelMessage,
} from "@gestor/core";
import { and, eq } from "drizzle-orm";
import { db } from "../client.js";
import { contacts } from "../schema.js";
import { mapContact } from "../mappers.js";

export class DrizzleContactRepository implements ContactRepository {
  async upsertFromInbound(
    organizationId: string,
    message: IOmnichannelMessage
  ): Promise<Contact> {
    // Solo mensajes del cliente pueden proponer nombre. Los salientes (eco de
    // OpenWA) suelen traer el nombre del número vinculado y no deben pisar nada.
    const incomingName =
      message.direction === "inbound"
        ? message.contact.name?.trim() || null
        : null;

    const existing = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, organizationId),
          eq(contacts.externalId, message.contact.externalId)
        )
      )
      .limit(1);

    if (existing[0]) {
      const prev = existing[0];
      // Saliente: no tocar el nombre. Entrante con nombre: es el del cliente, sí actualizar
      // (sirve para corregir si un eco previo guardó el nombre del número vinculado).
      const nextName =
        message.direction === "inbound" && incomingName
          ? incomingName
          : prev.name;
      const [row] = await db
        .update(contacts)
        .set({
          phone: message.contact.phone || prev.phone,
          name: nextName,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, prev.id))
        .returning();
      return mapContact(row!);
    }

    const [row] = await db
      .insert(contacts)
      .values({
        organizationId,
        channelType: message.channelType,
        externalId: message.contact.externalId,
        phone: message.contact.phone,
        name: incomingName,
        avatarUrl: message.contact.avatarUrl ?? null,
      })
      .returning();

    return mapContact(row!);
  }

  async upsertAgendaNames(
    organizationId: string,
    items: Array<{
      externalId: string;
      phone: string;
      name: string | null;
      avatarUrl?: string | null;
    }>
  ): Promise<void> {
    for (const item of items) {
      const name = item.name?.trim() || null;
      if (!name) continue;

      const existing = await db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.organizationId, organizationId),
            eq(contacts.externalId, item.externalId)
          )
        )
        .limit(1);

      if (existing[0]) {
        // Agenda solo rellena si aún no hay nombre; no pisa el del cliente.
        if (existing[0].name?.trim()) continue;
        await db
          .update(contacts)
          .set({
            phone: item.phone,
            name,
            ...(item.avatarUrl ? { avatarUrl: item.avatarUrl } : {}),
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, existing[0].id));
        continue;
      }

      await db.insert(contacts).values({
        organizationId,
        channelType: "whatsapp_unofficial",
        externalId: item.externalId,
        phone: item.phone,
        name,
        avatarUrl: item.avatarUrl ?? null,
      });
    }
  }
}
