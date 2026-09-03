import { useState } from "react";
import { Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Conversation } from "@/types";

interface Props {
  onCreated: (conversation: Conversation) => void;
}

export function NewConversationDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const conversation = await api<Conversation>("/conversations", {
        method: "POST",
        body: JSON.stringify({
          phone: phone.trim(),
          text: text.trim() || undefined,
        }),
      });
      setPhone("");
      setText("");
      setOpen(false);
      onCreated(conversation);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar la conversación");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <div className="border-b p-2">
        <Button size="sm" className="w-full" onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Nueva conversación
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2 border-b bg-white p-3">
      <p className="text-sm font-medium text-slate-700">Nueva conversación</p>
      <Input
        placeholder="Número (ej. 0981123456 o 595981123456)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
      />
      <Textarea
        rows={2}
        placeholder="Mensaje inicial (opcional)"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={sending} className="flex-1">
          {sending ? "Enviando…" : "Iniciar"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
