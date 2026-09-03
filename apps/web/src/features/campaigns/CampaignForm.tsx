import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, tokenStore } from "@/lib/api";
import type { CreateCampaignData } from "./useCampaigns";
import { TemplateSelector } from "./TemplateSelector";

interface Props {
  onCreate: (data: CreateCampaignData) => Promise<void>;
}

/** Parsea `dd/mm/yyyy` + `HH:mm` → ISO, o null si inválido. */
function toIsoFromDdMmYyyy(dateStr: string, timeStr: string): string | null {
  const m = dateStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const [hh = "0", mm = "0"] = (timeStr || "00:00").split(":");
  const hour = Number(hh);
  const minute = Number(mm);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  const d = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d.toISOString();
}

/** Enmascara mientras escribe hacia dd/mm/yyyy. */
function maskDdMmYyyy(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

async function downloadRecipientsTemplate() {
  const headers = new Headers();
  const token = tokenStore.access;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch("/api/campaigns/recipients-template", { headers });
  if (!res.ok) throw new Error("No se pudo descargar la plantilla");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla-destinatarios.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

export function CampaignForm({ onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [messageBody, setMessageBody] = useState("Hola {nombre}, ");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);
  const [tplName, setTplName] = useState("");
  const [showTplInput, setShowTplInput] = useState(false);
  const [downloadingTpl, setDownloadingTpl] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return setError("Subí un archivo .csv o .xlsx");

    let scheduledAt = new Date().toISOString();
    if (scheduledDate.trim()) {
      const iso = toIsoFromDdMmYyyy(scheduledDate, scheduledTime || "00:00");
      if (!iso) return setError("Fecha inválida. Usá el formato dd/mm/yyyy");
      scheduledAt = iso;
    }

    setSending(true);
    try {
      await onCreate({
        title,
        messageBody,
        scheduledAt,
        file,
      });
      setTitle("");
      setMessageBody("Hola {nombre}, ");
      setScheduledDate("");
      setScheduledTime("");
      setFile(null);
    } catch {
      setError("No se pudo crear la campaña");
    } finally {
      setSending(false);
    }
  }

  async function saveTemplate() {
    if (!tplName.trim() || !messageBody.trim()) return;
    setSavingTpl(true);
    try {
      await api("/templates", {
        method: "POST",
        body: JSON.stringify({ name: tplName.trim(), body: messageBody }),
      });
      setTplName("");
      setShowTplInput(false);
    } catch {
      setError("No se pudo guardar la plantilla");
    } finally {
      setSavingTpl(false);
    }
  }

  async function onDownloadTemplate() {
    setDownloadingTpl(true);
    setError(null);
    try {
      await downloadRecipientsTemplate();
    } catch {
      setError("No se pudo descargar la plantilla Excel");
    } finally {
      setDownloadingTpl(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border bg-white p-4">
      <h2 className="font-semibold">Nueva campaña</h2>
      <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <TemplateSelector onSelect={(body) => setMessageBody(body)} />
      <Textarea
        rows={3}
        value={messageBody}
        onChange={(e) => setMessageBody(e.target.value)}
        placeholder="Mensaje. Usá {nombre} para personalizar."
        required
      />
      <p className="text-xs text-slate-400">
        Tip: <code>{"{nombre}"}</code> se reemplaza con el nombre de cada destinatario.
      </p>
      {showTplInput ? (
        <div className="flex gap-2">
          <Input
            placeholder="Nombre de la plantilla"
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
            className="flex-1"
          />
          <Button type="button" onClick={() => void saveTemplate()} disabled={savingTpl}>
            {savingTpl ? "Guardando…" : "Guardar"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setShowTplInput(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowTplInput(true)}
          className="text-xs text-blue-600 hover:underline"
        >
          Guardar mensaje como plantilla
        </button>
      )}
      <div className="space-y-1">
        <p className="text-sm text-slate-600">Programar para (opcional)</p>
        <div className="grid grid-cols-2 gap-2">
          <Input
            inputMode="numeric"
            placeholder="dd/mm/yyyy"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(maskDdMmYyyy(e.target.value))}
            maxLength={10}
            aria-label="Fecha dd/mm/yyyy"
          />
          <Input
            type="time"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            aria-label="Hora"
          />
        </div>
        <p className="text-xs text-slate-400">Formato: dd/mm/yyyy — ej. 03/09/2026</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void onDownloadTemplate()}
          disabled={downloadingTpl}
        >
          <Download className="mr-1 h-4 w-4" />
          {downloadingTpl ? "Descargando…" : "Descargar plantilla Excel"}
        </Button>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <Upload className="h-4 w-4" />
          <span>{file ? file.name : "Subir .csv o .xlsx"}</span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <p className="text-xs text-slate-400">
        La plantilla trae columnas <code>telefono</code> y <code>nombre</code>. Completala y subila acá.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={sending} className="w-full">
        {sending ? "Creando..." : "Crear y encolar"}
      </Button>
    </form>
  );
}
