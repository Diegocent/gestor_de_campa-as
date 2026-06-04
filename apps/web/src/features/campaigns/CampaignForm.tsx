import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CreateCampaignData } from "./useCampaigns";

interface Props {
  onCreate: (data: CreateCampaignData) => Promise<void>;
}

export function CampaignForm({ onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [messageBody, setMessageBody] = useState("Hola {nombre}, ");
  const [scheduledAt, setScheduledAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return setError("Subí un archivo .csv o .xlsx");
    setSending(true);
    try {
      await onCreate({
        title,
        messageBody,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
        file,
      });
      setTitle("");
      setMessageBody("Hola {nombre}, ");
      setScheduledAt("");
      setFile(null);
    } catch {
      setError("No se pudo crear la campaña");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border bg-white p-4">
      <h2 className="font-semibold">Nueva campaña</h2>
      <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} required />
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
      <label className="block text-sm text-slate-600">
        Programar para (opcional)
        <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
      </label>
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={sending} className="w-full">
        {sending ? "Creando..." : "Crear y encolar"}
      </Button>
    </form>
  );
}
