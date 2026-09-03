import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MessageTemplate } from "@/types";

interface Props {
  onSelect: (body: string) => void;
}

export function TemplateSelector({ onSelect }: Props) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<MessageTemplate[]>("/templates")
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (templates.length === 0)
    return <p className="text-xs text-slate-400">Sin plantillas guardadas.</p>;

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-500 shrink-0">Plantilla:</label>
      <select
        className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        defaultValue=""
        onChange={(e) => {
          const tpl = templates.find((t) => t.id === e.target.value);
          if (tpl) onSelect(tpl.body);
          e.target.value = "";
        }}
      >
        <option value="" disabled>
          Seleccioná una plantilla…
        </option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
