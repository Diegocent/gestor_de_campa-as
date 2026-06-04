import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type {
  AgentRepository,
  ConversationRepository,
  InboxMessageRepository,
  RealtimePublisher,
  SendAgentMessageUseCase,
} from "@gestor/core";

export interface InboxRouteDeps {
  conversations: ConversationRepository;
  messages: InboxMessageRepository;
  agents: AgentRepository;
  sendAgentMessage: SendAgentMessageUseCase;
  realtime: RealtimePublisher;
}

const listQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(["open", "pending", "resolved", "snoozed"]).optional(),
});

const sendBody = z.object({ text: z.string().min(1).max(4096) });

export function registerInboxRoutes(app: FastifyInstance, deps: InboxRouteDeps): void {
  const auth = { preHandler: (req: any, reply: any) => app.authenticate(req, reply) };

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
    const body = sendBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Mensaje inválido" });
    try {
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
}
