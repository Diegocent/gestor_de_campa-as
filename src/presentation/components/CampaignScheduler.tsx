"use client";



import { useCallback, useEffect, useMemo, useState } from "react";

import type { CampaignRecipient, Organization } from "@/domain/types";

import {

  defaultScheduledAtLocal,

  formatDateTimePy,

  fromDatetimeLocalValue,

  toDatetimeLocalValue,

} from "@/domain/datetime";

import { parsePhoneList } from "@/domain/phone";

import { personalizeMessage } from "@/domain/message-template";

import { parseSpreadsheetFile } from "@/presentation/utils/parse-spreadsheet";

import { BrandHeader } from "./BrandHeader";
import { SendRateSettings } from "./SendRateSettings";



interface CampaignSummary {

  id: string;

  title: string;

  scheduledAt: string;

  status: string;

  totalRecipients: number;

  sentCount: number;

  failedCount: number;

}



type RecipientMode = "manual" | "excel";



interface ScheduleFormState {

  title: string;

  messageBody: string;

  recipientMode: RecipientMode;

  phoneNumbers: string;

  recipients: CampaignRecipient[];

  excelFileName: string | null;

  scheduledAt: string;

}



const STATUS_LABELS: Record<string, string> = {
  scheduled: "Programada",
  processing: "En proceso",
  completed: "Completada",
  partially_failed: "Con fallos",
  cancelled: "Cancelada",
  draft: "Borrador",
};

const CAMPAIGNS_PAGE_SIZE = 10;



function emptyForm(): ScheduleFormState {

  return {

    title: "",

    messageBody: "",

    recipientMode: "manual",

    phoneNumbers: "",

    recipients: [],

    excelFileName: null,

    scheduledAt: defaultScheduledAtLocal(),

  };

}



function countPhones(input: string): number {

  return parsePhoneList(input).length;

}



function isEditable(campaign: CampaignSummary): boolean {

  if (campaign.status === "cancelled") return false;

  return campaign.sentCount < campaign.totalRecipients;

}



function buildRecipients(form: ScheduleFormState): CampaignRecipient[] {

  if (form.recipientMode === "excel") {

    return form.recipients;

  }



  return parsePhoneList(form.phoneNumbers).map((phoneNumber) => ({ phoneNumber }));

}



export function CampaignScheduler() {

  const [organization, setOrganization] = useState<Organization | null>(null);

  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);

  const [form, setForm] = useState<ScheduleFormState>(emptyForm());

  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [importLoading, setImportLoading] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(

    null

  );

  const [sendRateLabel, setSendRateLabel] = useState("10 mensajes / 5 min");

  const [campaignPage, setCampaignPage] = useState(1);

  const [campaignPagination, setCampaignPagination] = useState({

    total: 0,

    totalPages: 1,

  });

  const [campaignsLoading, setCampaignsLoading] = useState(false);



  const recipientCount = useMemo(() => {

    if (form.recipientMode === "excel") {

      return form.recipients.length;

    }

    return countPhones(form.phoneNumbers);

  }, [form.recipientMode, form.recipients.length, form.phoneNumbers]);



  const messagePreview = useMemo(() => {

    const sample =

      form.recipientMode === "excel"

        ? form.recipients[0]

        : { phoneNumber: "", recipientName: "María" };



    if (!sample || !form.messageBody.trim()) return null;



    return personalizeMessage(form.messageBody, {

      recipientName: sample.recipientName ?? "María",

    });

  }, [form.messageBody, form.recipientMode, form.recipients]);



  const scheduledAtPreview = useMemo(

    () => formatDateTimePy(fromDatetimeLocalValue(form.scheduledAt)),

    [form.scheduledAt]

  );

  const isEditing = editingId !== null;



  const loadCampaigns = useCallback(async (page: number) => {

    setCampaignsLoading(true);

    try {

      const response = await fetch(

        `/api/campaigns?page=${page}&pageSize=${CAMPAIGNS_PAGE_SIZE}`

      );

      if (!response.ok) return;

      const data = await response.json();

      setCampaigns(data.campaigns ?? []);

      setCampaignPagination({

        total: data.total ?? 0,

        totalPages: data.totalPages ?? 1,

      });

      setCampaignPage(data.page ?? page);

    } finally {

      setCampaignsLoading(false);

    }

  }, []);



  useEffect(() => {

    void (async () => {

      const orgRes = await fetch("/api/organization");

      if (orgRes.ok) {

        setOrganization(await orgRes.json());

      }

    })();

  }, []);



  useEffect(() => {

    void loadCampaigns(campaignPage);

  }, [campaignPage, loadCampaigns]);



  const refreshCampaigns = useCallback(async () => {

    const response = await fetch(

      `/api/campaigns?page=${campaignPage}&pageSize=${CAMPAIGNS_PAGE_SIZE}`

    );

    if (!response.ok) return;

    const data = await response.json();

    const items = data.campaigns ?? [];

    if (items.length === 0 && campaignPage > 1) {

      setCampaignPage(campaignPage - 1);

      return;

    }

    setCampaigns(items);

    setCampaignPagination({

      total: data.total ?? 0,

      totalPages: data.totalPages ?? 1,

    });

  }, [campaignPage]);



  const resetForm = () => {

    setEditingId(null);

    setForm(emptyForm());

  };



  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {

    const file = event.target.files?.[0];

    event.target.value = "";



    if (!file) return;



    setImportLoading(true);

    setFeedback(null);



    try {

      const recipients = await parseSpreadsheetFile(file);

      setForm((prev) => ({

        ...prev,

        recipientMode: "excel",

        recipients,

        excelFileName: file.name,

        phoneNumbers: "",

      }));

    } catch (error) {

      setFeedback({

        type: "error",

        text: error instanceof Error ? error.message : "No se pudo leer el archivo",

      });

    } finally {

      setImportLoading(false);

    }

  };



  const handleEdit = async (campaignId: string) => {

    setActionLoadingId(campaignId);

    setFeedback(null);



    try {

      const response = await fetch(`/api/campaigns/${campaignId}`);

      const data = await response.json();



      if (!response.ok) {

        throw new Error(data.error ?? "No se pudo cargar la campaña");

      }



      if (!data.editable) {

        throw new Error("Esta campaña ya no se puede modificar");

      }



      const messages = data.messages as {

        phoneNumber: string;

        recipientName?: string | null;

      }[];



      const hasNames = messages.some((message) => message.recipientName?.trim());

      const recipients = messages.map((message) => ({

        phoneNumber: message.phoneNumber,

        recipientName: message.recipientName ?? undefined,

      }));



      setEditingId(campaignId);

      setForm({

        title: data.campaign.title,

        messageBody: data.campaign.messageBody,

        recipientMode: hasNames ? "excel" : "manual",

        recipients: hasNames ? recipients : [],

        excelFileName: hasNames ? "Destinatarios cargados" : null,

        phoneNumbers: hasNames ? "" : recipients.map((r) => r.phoneNumber).join("\n"),

        scheduledAt: toDatetimeLocalValue(data.campaign.scheduledAt),

      });



      window.scrollTo({ top: 0, behavior: "smooth" });

    } catch (error) {

      setFeedback({

        type: "error",

        text: error instanceof Error ? error.message : "Error inesperado",

      });

    } finally {

      setActionLoadingId(null);

    }

  };



  const handleDelete = async (campaign: CampaignSummary) => {

    if (!isEditable(campaign)) return;



    const confirmed = window.confirm(

      `¿Eliminar la campaña "${campaign.title}"? Se cancelarán los envíos pendientes.`

    );

    if (!confirmed) return;



    setActionLoadingId(campaign.id);

    setFeedback(null);



    try {

      const response = await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });

      const data = await response.json();



      if (!response.ok) {

        throw new Error(data.error ?? "No se pudo eliminar la campaña");

      }



      if (editingId === campaign.id) {

        resetForm();

      }



      setFeedback({ type: "success", text: "Campaña eliminada correctamente" });

      await refreshCampaigns();

    } catch (error) {

      setFeedback({

        type: "error",

        text: error instanceof Error ? error.message : "Error inesperado",

      });

    } finally {

      setActionLoadingId(null);

    }

  };



  const handleSubmit = async (event: React.FormEvent) => {

    event.preventDefault();

    setLoading(true);

    setFeedback(null);



    try {

      const recipients = buildRecipients(form);



      if (recipients.length === 0) {

        throw new Error("Ingresá al menos un destinatario válido");

      }



      const payload = {

        title: form.title,

        messageBody: form.messageBody,

        recipients,

        scheduledAt: fromDatetimeLocalValue(form.scheduledAt).toISOString(),

      };



      const response = await fetch(

        isEditing ? `/api/campaigns/${editingId}` : "/api/campaigns",

        {

          method: isEditing ? "PATCH" : "POST",

          headers: { "Content-Type": "application/json" },

          body: JSON.stringify(payload),

        }

      );



      const data = await response.json();



      if (!response.ok) {

        throw new Error(data.error ?? "No se pudo guardar la campaña");

      }



      setFeedback({

        type: "success",

        text: isEditing

          ? `Campaña actualizada: ${data.scheduledCount} mensajes reprogramados`

          : `Campaña programada: ${data.scheduledCount} mensajes para ${formatDateTimePy(data.scheduledAt ?? payload.scheduledAt)}`,

      });



      resetForm();

      setCampaignPage(1);

      await loadCampaigns(1);

    } catch (error) {

      setFeedback({

        type: "error",

        text: error instanceof Error ? error.message : "Error inesperado",

      });

    } finally {

      setLoading(false);

    }

  };



  const primaryColor = organization?.branding.primaryColor ?? "#2563eb";



  return (

    <div className="mx-auto max-w-5xl px-4 py-10">

      {organization && <BrandHeader organization={organization} />}



      <div className="grid gap-8 lg:grid-cols-5">

        <form

          onSubmit={handleSubmit}

          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-3"

        >

          <div>

            <h2 className="text-lg font-semibold text-slate-900">

              {isEditing ? "Modificar campaña" : "Nueva campaña"}

            </h2>

            <p className="mt-1 text-sm text-slate-500">

              {isEditing

                ? "Los cambios reprograman los mensajes pendientes en la cola."

                : `Importá un Excel con nombres para personalizar cada mensaje. Ritmo actual: ${sendRateLabel}.`}

            </p>

          </div>



          <Field label="Título de la campaña">

            <input

              required

              value={form.title}

              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}

              placeholder="Recordatorio de pago - Mayo 2026"

              className="field-input"

            />

          </Field>



          <Field label="Destinatarios">

            <div className="mb-3 flex gap-2">

              <ModeButton

                active={form.recipientMode === "manual"}

                onClick={() =>

                  setForm((prev) => ({

                    ...prev,

                    recipientMode: "manual",

                    recipients: [],

                    excelFileName: null,

                  }))

                }

              >

                Lista manual

              </ModeButton>

              <ModeButton

                active={form.recipientMode === "excel"}

                onClick={() =>

                  setForm((prev) => ({

                    ...prev,

                    recipientMode: "excel",

                    phoneNumbers: "",

                  }))

                }

              >

                Excel / CSV

              </ModeButton>

            </div>



            {form.recipientMode === "manual" ? (

              <>

                <textarea

                  required={form.recipientMode === "manual"}

                  rows={6}

                  value={form.phoneNumbers}

                  onChange={(e) => setForm((prev) => ({ ...prev, phoneNumbers: e.target.value }))}

                  placeholder={"Un número por línea, coma o punto y coma\n981123456\n982234567"}

                  className="field-input font-mono text-sm"

                />

                <p className="mt-1 text-xs text-slate-500">

                  {recipientCount} número{recipientCount !== 1 ? "s" : ""} detectado

                  {recipientCount !== 1 ? "s" : ""}. Podés usar {"{nombre}"} en el mensaje; si no

                  hay nombre, se usará &quot;cliente&quot;.

                </p>

              </>

            ) : (

              <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">

                <label className="flex cursor-pointer flex-col items-center gap-2 text-sm text-slate-600">

                  <span className="font-medium text-slate-800">

                    {importLoading

                      ? "Leyendo archivo..."

                      : form.excelFileName ?? "Seleccionar archivo Excel o CSV"}

                  </span>

                  <span className="text-xs text-slate-500">

                    Columnas requeridas: telefono (o celular/phone) y nombre (o name/cliente)

                  </span>

                  <input

                    type="file"

                    accept=".xlsx,.xls,.csv"

                    disabled={importLoading}

                    onChange={(e) => void handleExcelImport(e)}

                    className="hidden"

                  />

                  <span className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">

                    Elegir archivo

                  </span>

                </label>



                {form.recipients.length > 0 && (

                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">

                    <table className="w-full text-left text-xs">

                      <thead className="bg-slate-100 text-slate-600">

                        <tr>

                          <th className="px-3 py-2 font-medium">Nombre</th>

                          <th className="px-3 py-2 font-medium">Teléfono</th>

                        </tr>

                      </thead>

                      <tbody>

                        {form.recipients.slice(0, 5).map((recipient) => (

                          <tr key={recipient.phoneNumber} className="border-t border-slate-100">

                            <td className="px-3 py-2">{recipient.recipientName ?? "—"}</td>

                            <td className="px-3 py-2 font-mono">{recipient.phoneNumber}</td>

                          </tr>

                        ))}

                      </tbody>

                    </table>

                    {form.recipients.length > 5 && (

                      <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">

                        y {form.recipients.length - 5} fila{form.recipients.length - 5 !== 1 ? "s" : ""}{" "}

                        más...

                      </p>

                    )}

                  </div>

                )}



                <p className="text-xs text-slate-500">

                  {recipientCount} destinatario{recipientCount !== 1 ? "s" : ""} listo

                  {recipientCount !== 1 ? "s" : ""} para envío personalizado.

                </p>

              </div>

            )}

          </Field>



          <Field label="Mensaje">

            <textarea

              required

              rows={5}

              value={form.messageBody}

              onChange={(e) => setForm((prev) => ({ ...prev, messageBody: e.target.value }))}

              placeholder="Estimado/a {nombre}, le recordamos su cuota pendiente..."

              className="field-input"

            />

            <p className="mt-1 text-xs text-slate-500">

              Usá <code className="rounded bg-slate-100 px-1">{"{nombre}"}</code> o{" "}

              <code className="rounded bg-slate-100 px-1">{"{name}"}</code> para insertar el nombre

              de cada fila del Excel.

            </p>

            {messagePreview && (

              <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">

                <span className="font-medium">Vista previa:</span> {messagePreview}

              </p>

            )}

          </Field>



          <Field label="Fecha y hora de envío">

            <input

              required

              type="datetime-local"

              value={form.scheduledAt}

              onChange={(e) => setForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}

              className="field-input"

            />

            <p className="mt-1 text-xs text-slate-500">

              Formato: <span className="font-medium text-slate-700">{scheduledAtPreview}</span>{" "}

              (DD/MM/AAAA HH:mm)

            </p>

          </Field>



          {feedback && (

            <div

              className={`rounded-lg px-4 py-3 text-sm ${

                feedback.type === "success"

                  ? "bg-emerald-50 text-emerald-800"

                  : "bg-red-50 text-red-800"

              }`}

            >

              {feedback.text}

            </div>

          )}



          <div className="flex gap-3">

            {isEditing && (

              <button

                type="button"

                onClick={resetForm}

                disabled={loading}

                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"

              >

                Cancelar

              </button>

            )}

            <button

              type="submit"

              disabled={loading || (form.recipientMode === "excel" && recipientCount === 0)}

              className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"

              style={{ backgroundColor: primaryColor }}

            >

              {loading

                ? isEditing

                  ? "Guardando..."

                  : "Programando..."

                : isEditing

                  ? "Guardar cambios"

                  : "Programar envío"}

            </button>

          </div>

        </form>



        <aside className="space-y-4 lg:col-span-2">

          <SendRateSettings
            primaryColor={primaryColor}
            onRateChange={setSendRateLabel}
          />

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">

          <h2 className="text-lg font-semibold text-slate-900">Campañas recientes</h2>

          <p className="mt-1 mb-4 text-sm text-slate-500">

            Mostrando las últimas campañas ({CAMPAIGNS_PAGE_SIZE} por página). Podés modificar o

            eliminar mientras queden destinatarios sin enviar.

          </p>



          {campaignsLoading ? (

            <p className="text-sm text-slate-500">Cargando campañas...</p>

          ) : campaigns.length === 0 ? (

            <p className="text-sm text-slate-500">Aún no hay campañas registradas.</p>

          ) : (

            <ul className="space-y-3">

              {campaigns.map((campaign) => (

                <li

                  key={campaign.id}

                  className={`rounded-xl border bg-white p-4 text-sm ${

                    editingId === campaign.id

                      ? "border-blue-400 ring-2 ring-blue-100"

                      : "border-slate-200"

                  }`}

                >

                  <p className="font-medium text-slate-900">{campaign.title}</p>

                  <p className="mt-1 text-slate-500">{formatDateTimePy(campaign.scheduledAt)}</p>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs">

                    <Badge>{STATUS_LABELS[campaign.status] ?? campaign.status}</Badge>

                    <Badge>{campaign.totalRecipients} destinatarios</Badge>

                    <Badge variant="success">{campaign.sentCount} enviados</Badge>

                    {campaign.failedCount > 0 && (

                      <Badge variant="danger">{campaign.failedCount} fallidos</Badge>

                    )}

                  </div>



                  {isEditable(campaign) && (

                    <div className="mt-3 flex gap-2">

                      <button

                        type="button"

                        disabled={actionLoadingId === campaign.id}

                        onClick={() => void handleEdit(campaign.id)}

                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"

                      >

                        Modificar

                      </button>

                      <button

                        type="button"

                        disabled={actionLoadingId === campaign.id}

                        onClick={() => void handleDelete(campaign)}

                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"

                      >

                        Eliminar

                      </button>

                    </div>

                  )}

                </li>

              ))}

            </ul>

          )}



          {campaignPagination.totalPages > 1 && (

            <CampaignPagination

              page={campaignPage}

              totalPages={campaignPagination.totalPages}

              total={campaignPagination.total}

              pageSize={CAMPAIGNS_PAGE_SIZE}

              onPageChange={setCampaignPage}

            />

          )}

          </div>

        </aside>

      </div>

    </div>

  );

}



function CampaignPagination({

  page,

  totalPages,

  total,

  pageSize,

  onPageChange,

}: {

  page: number;

  totalPages: number;

  total: number;

  pageSize: number;

  onPageChange: (page: number) => void;

}) {

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;

  const to = Math.min(page * pageSize, total);



  return (

    <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">

      <p className="text-xs text-slate-500">

        {from}-{to} de {total} campaña{total !== 1 ? "s" : ""}

      </p>

      <div className="flex items-center gap-2">

        <button

          type="button"

          disabled={page <= 1}

          onClick={() => onPageChange(page - 1)}

          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"

        >

          Anterior

        </button>

        <span className="text-xs text-slate-600">

          Página {page} de {totalPages}

        </span>

        <button

          type="button"

          disabled={page >= totalPages}

          onClick={() => onPageChange(page + 1)}

          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"

        >

          Siguiente

        </button>

      </div>

    </div>

  );

}



function ModeButton({

  active,

  onClick,

  children,

}: {

  active: boolean;

  onClick: () => void;

  children: React.ReactNode;

}) {

  return (

    <button

      type="button"

      onClick={onClick}

      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${

        active

          ? "bg-slate-900 text-white"

          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"

      }`}

    >

      {children}

    </button>

  );

}



function Field({ label, children }: { label: string; children: React.ReactNode }) {

  return (

    <label className="block">

      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>

      {children}

    </label>

  );

}



function Badge({

  children,

  variant = "default",

}: {

  children: React.ReactNode;

  variant?: "default" | "success" | "danger";

}) {

  const styles = {

    default: "bg-slate-100 text-slate-700",

    success: "bg-emerald-100 text-emerald-700",

    danger: "bg-red-100 text-red-700",

  };



  return (

    <span className={`rounded-full px-2.5 py-0.5 font-medium ${styles[variant]}`}>

      {children}

    </span>

  );

}

