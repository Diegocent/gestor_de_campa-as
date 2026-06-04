import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SendRate } from "@/types";

export function SendRateSettings() {
  const [rate, setRate] = useState<SendRate>({ maxMessages: 10, durationMinutes: 5 });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<SendRate>("/settings/send-rate")
      .then(setRate)
      .catch(() => undefined);
  }, []);

  async function save() {
    const updated = await api<SendRate>("/settings/send-rate", {
      method: "PATCH",
      body: JSON.stringify(rate),
    });
    setRate(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-3 rounded-xl border bg-white p-4">
      <h2 className="font-semibold">Límite de envío</h2>
      <p className="text-xs text-slate-400">
        Controla el ritmo para no levantar sospechas de spam. Se aplica en caliente.
      </p>
      <label className="block text-sm text-slate-600">
        Máximo de mensajes
        <Input
          type="number"
          min={1}
          value={rate.maxMessages}
          onChange={(e) => setRate({ ...rate, maxMessages: Number(e.target.value) })}
        />
      </label>
      <label className="block text-sm text-slate-600">
        Cada (minutos)
        <Input
          type="number"
          min={1}
          value={rate.durationMinutes}
          onChange={(e) => setRate({ ...rate, durationMinutes: Number(e.target.value) })}
        />
      </label>
      <Button onClick={() => void save()} className="w-full">
        {saved ? "Guardado ✓" : "Guardar"}
      </Button>
    </div>
  );
}
