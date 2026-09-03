import type { FastifyInstance } from "fastify";
import { z } from "zod";
import ExcelJS from "exceljs";
import type { CampaignJobQueue, CampaignRepository } from "@gestor/core";
import type { CreateCampaignService } from "../../campaigns/create-campaign.service.js";
import { parseRecipients } from "../../campaigns/spreadsheet-stream.js";

export interface CampaignRouteDeps {
  createCampaign: CreateCampaignService;
  campaigns: CampaignRepository;
  queue: CampaignJobQueue;
}

const listQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
});

export function registerCampaignRoutes(app: FastifyInstance, deps: CampaignRouteDeps): void {
  const auth = { preHandler: (req: any, reply: any) => app.authenticate(req, reply) };

  // Crear campaña: multipart con campos (title, messageBody, scheduledAt) + archivo.
  app.post("/campaigns", auth, async (request, reply) => {
    const fields: Record<string, string> = {};
    let created = null;

    for await (const part of request.parts()) {
      if (part.type !== "file") {
        fields[part.fieldname] = String(part.value ?? "");
        continue;
      }
      if (!fields.title || !fields.messageBody) {
        part.file.resume();
        return reply.code(400).send({ error: "Faltan campos: title y messageBody" });
      }
      const scheduledAt = fields.scheduledAt ? new Date(fields.scheduledAt) : new Date();
      created = await deps.createCampaign.create({
        organizationId: request.agent!.organizationId,
        title: fields.title,
        messageBody: fields.messageBody,
        scheduledAt,
        recipients: parseRecipients(part.file, part.filename),
      });
    }

    if (!created) return reply.code(400).send({ error: "Falta el archivo de destinatarios" });
    return reply.code(201).send(created);
  });

  // Plantilla Excel para destinatarios (antes de /:id para no chocar).
  app.get("/campaigns/recipients-template", auth, async (_request, reply) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Destinatarios");
    ws.columns = [
      { header: "telefono", key: "telefono", width: 18 },
      { header: "nombre", key: "nombre", width: 28 },
    ];
    ws.addRow({ telefono: "595981234567", nombre: "Juan Pérez" });
    ws.addRow({ telefono: "595971112233", nombre: "María López" });
    ws.getRow(1).font = { bold: true };

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return reply
      .header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
      .header("Content-Disposition", 'attachment; filename="plantilla-destinatarios.xlsx"')
      .send(buffer);
  });

  app.get("/campaigns", auth, async (request, reply) => {
    const q = listQuery.safeParse(request.query);
    if (!q.success) return reply.code(400).send({ error: "Parámetros inválidos" });
    const result = await deps.campaigns.listCampaigns({
      organizationId: request.agent!.organizationId,
      page: q.data.page,
      pageSize: q.data.pageSize,
    });
    return reply.send(result);
  });

  app.get("/campaigns/:id", auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await deps.campaigns.getCampaign(request.agent!.organizationId, id);
    if (!campaign) return reply.code(404).send({ error: "Campaña no encontrada" });
    return reply.send(campaign);
  });

  app.post("/campaigns/:id/cancel", auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const cancelledIds = await deps.campaigns.cancelCampaign(
      request.agent!.organizationId,
      id
    );
    await deps.queue.removeJobs(cancelledIds);
    return reply.send({ cancelled: cancelledIds.length });
  });
}
