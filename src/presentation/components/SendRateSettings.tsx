"use client";

import { useCallback, useEffect, useState } from "react";
import { SEND_RATE_LIMITS } from "@/domain/send-rate";

interface SendRateState {
  maxMessages: number;
  durationMinutes: number;
}

interface SendRateSettingsProps {
  primaryColor: string;
  onRateChange?: (label: string) => void;
}

export function SendRateSettings({ primaryColor, onRateChange }: SendRateSettingsProps) {
  const [form, setForm] = useState<SendRateState>({ maxMessages: 10, durationMinutes: 5 });
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const loadSettings = useCallback(async () => {
    const response = await fetch("/api/settings");
    if (!response.ok) return;

    const data = await response.json();
    setForm(data.sendRate);
    setLabel(data.label);
    onRateChange?.(data.label);
  }, [onRateChange]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await loadSettings();
      setLoading(false);
    })();
  }, [loadSettings]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo guardar la configuración");
      }

      setLabel(data.label);
      onRateChange?.(data.label);
      setFeedback({
        type: "success",
        text: "Configuración guardada. Reiniciá el worker para aplicarla: docker compose restart worker",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Error inesperado",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Cargando configuración de envío...
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Ritmo de envío</h3>
      <p className="mt-1 text-xs text-slate-500">
        Actual: <span className="font-medium text-slate-700">{label}</span>. Un intervalo más largo
        reduce el riesgo de que WhatsApp detecte envíos masivos.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-slate-700">
            Mensajes máximos
            <input
              type="number"
              min={SEND_RATE_LIMITS.maxMessages.min}
              max={SEND_RATE_LIMITS.maxMessages.max}
              required
              value={form.maxMessages}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, maxMessages: Number(e.target.value) }))
              }
              className="field-input mt-1"
            />
          </label>

          <label className="block text-xs font-medium text-slate-700">
            Cada (minutos)
            <input
              type="number"
              min={SEND_RATE_LIMITS.durationMinutes.min}
              max={SEND_RATE_LIMITS.durationMinutes.max}
              required
              value={form.durationMinutes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, durationMinutes: Number(e.target.value) }))
              }
              className="field-input mt-1"
            />
          </label>
        </div>

        {feedback && (
          <p
            className={`rounded-lg px-3 py-2 text-xs ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {feedback.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: primaryColor }}
        >
          {saving ? "Guardando..." : "Guardar ritmo de envío"}
        </button>
      </form>
    </section>
  );
}
