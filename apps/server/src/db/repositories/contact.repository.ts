import type {
  Contact,
  ContactRepository,
  IOmnichannelMessage,
} from "@gestor/core";
import { db } from "../client.js";
import { contacts } from "../schema.js";
import { mapContact } from "../mappers.js";

export class DrizzleContactRepository implements ContactRepository {
  async upsertFromInbound(
    organizationId: string,
    message: IOmnichannelMessage
  ): Promise<Contact> {
    const [row] = await db
      .insert(contacts)
      .values({
        organizationId,
        channelType: message.channelType,
        externalId: message.contact.externalId,
        phone: message.contact.phone,
        name: message.contact.name ?? null,
        avatarUrl: message.contact.avatarUrl ?? null,
      })
      .onConflictDoUpdate({
        target: [contacts.organizationId, contacts.externalId],
        set: {
          phone: message.contact.phone,
          name: message.contact.name ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return mapContact(row!);
  }
}
