import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  AgentRepository,
  ConversationRepository,
  InboxMessageRepository,
  RealtimePublisher,
  SendAgentMessageUseCase,
  StartConversationUseCase,
} from "@gestor/core";

export interface InboxRouteDeps {
  conversations: ConversationRepository;
  messages: InboxMessageRepository;
  agents: AgentRepository;
  sendAgentMessage: SendAgentMessageUseCase;
  startConversation: StartConversationUseCase;
  realtime: RealtimePublisher;
}

const listQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(["open", "pending", "resolved", "snoozed"]).optional(),
});

const sendJsonBody = z.object({
  text: z.string().max(4096).optional(),
});

const startBody = z.object({
  phone: z.string().min(6).max(32),
  text: z.string().max(4096).optional(),
  sessionName: z.string().min(1).max(64).optional(),
});

const MAX_UPLOAD_BYTES = 16 * 1024 * 1024;

const uploadDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "uploads"
);
mkdirSync(uploadDir, { recursive: true });

function safeFileName(original: string): string {
  const base = path.basename(original).replace(/[^\w.\-()+ ]+/g, "_");
  return `${randomUUID()}-${base || "file"}`;
}

export function registerInboxRoutes(app: FastifyInstance, deps: InboxRouteDeps): void {
  const auth = { preHandler: (req: any, reply: any) => app.authenticate(req, reply) };

  app.get("/media/:fileName", async (request, reply) => {
    const { fileName } = request.params as { fileName: string };
    const safe = path.basename(fileName);
    const full = path.join(uploadDir, safe);
    if (!existsSync(full)) return reply.code(404).send({ error: "Archivo no encontrado" });
    const ext = path.extname(safe).toLowerCase();
    const types: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mp3": "audio/mpeg",
      ".ogg": "audio/ogg",
      ".wav": "audio/wav",
      ".pdf": "application/pdf",
    };
    if (types[ext]) reply.type(types[ext]);
    return reply.send(createReadStream(full));
  });

  app.get("/agents", auth, async (request, reply) => {
    const list = await deps.agents.listByOrganization(request.agent!.organizationId);
    return reply.send(list);
  });

  app.get("/conversations", auth, async (request, reply) => {
    const q = listQuery.safeParse(request.query);
    if (!q.success) return reply.code(400).send({ error: "Parámetros inválidos" });
    const result = await deps.conversations.list({
      organizationId: request.agent!.organizationId,
      page: q.data.page,
      pageSize: q.data.pageSize,
      status: q.data.status,
    });
    return reply.send(result);
  });

  /** Inicia o reabre una conversación hacia un número. */
  app.post("/conversations", auth, async (request, reply) => {
    const body = startBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Datos inválidos" });
    try {
      const conversation = await deps.startConversation.execute({
        organizationId: request.agent!.organizationId,
        agentId: request.agent!.sub,
        phone: body.data.phone,
        text: body.data.text,
        sessionName: body.data.sessionName,
      });
      deps.realtime.emitConversationUpdate(request.agent!.organizationId, { conversation });
      return reply.code(201).send(conversation);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error";
      return reply.code(400).send({ error: message });
    }
  });

  app.get("/conversations/:id/messages", auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = listQuery.safeParse(request.query);
    if (!q.success) return reply.code(400).send({ error: "Parámetros inválidos" });
    const result = await deps.messages.listByConversation({
      conversationId: id,
      page: q.data.page,
      pageSize: q.data.pageSize,
    });
    return reply.send(result);
  });

  app.post("/conversations/:id/messages", auth, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      if (request.isMultipart()) {
        let text: string | undefined;
        let media:
          | {
              storedUrl: string;
              base64: string;
              mimeType: string;
              filename: string;
            }
          | undefined;

        for await (const part of request.parts()) {
          if (part.type === "file") {
            const chunks: Buffer[] = [];
            let size = 0;
            for await (const chunk of part.file) {
              size += chunk.length;
              if (size > MAX_UPLOAD_BYTES) {
                part.file.resume();
                return reply.code(400).send({ error: "Archivo demasiado grande (máx. 16 MB)" });
              }
              chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            const filename = safeFileName(part.filename || "file");
            writeFileSync(path.join(uploadDir, filename), buffer);
            media = {
              storedUrl: `/media/${filename}`,
              base64: buffer.toString("base64"),
              mimeType: part.mimetype || "application/octet-stream",
              filename: part.filename || filename,
            };
          } else if (part.fieldname === "text") {
            text = String(part.value ?? "");
          }
        }

        await deps.sendAgentMessage.execute({
          organizationId: request.agent!.organizationId,
          conversationId: id,
          agentId: request.agent!.sub,
          text,
          media,
        });
        return reply.code(202).send({ accepted: true });
      }

      const body = sendJsonBody.safeParse(request.body);
      if (!body.success || !body.data.text?.trim()) {
        return reply.code(400).send({ error: "Mensaje inválido" });
      }
      await deps.sendAgentMessage.execute({
        organizationId: request.agent!.organizationId,
        conversationId: id,
        agentId: request.agent!.sub,
        text: body.data.text,
      });
      return reply.code(202).send({ accepted: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error";
      return reply.code(400).send({ error: message });
    }
  });

  app.post("/conversations/:id/read", auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.conversations.resetUnread(id);
    return reply.send({ ok: true });
  });

  app.post("/conversations/:id/assign", auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({ agentId: z.string().uuid().nullable() });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Datos inválidos" });
    const updated = await deps.conversations.assign(id, body.data.agentId);
    deps.realtime.emitConversationUpdate(request.agent!.organizationId, {
      conversation: updated,
    });
    return reply.send(updated);
  });

  app.patch("/conversations/:id/status", auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      status: z.enum(["open", "pending", "resolved", "snoozed"]),
    });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Estado inválido" });
    const updated = await deps.conversations.setStatus(id, body.data.status);
    deps.realtime.emitConversationUpdate(request.agent!.organizationId, {
      conversation: updated,
    });
    return reply.send(updated);
  });
}
