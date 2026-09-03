import { useEffect, useState, useCallback } from "react";
import { UserPlus, ShieldCheck, User } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Agent } from "@/types";
import { cn } from "@/lib/utils";

interface NewAgentForm {
  email: string;
  name: string;
  password: string;
  role: "admin" | "agent";
}

const INITIAL_FORM: NewAgentForm = { email: "", name: "", password: "", role: "agent" };

export function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewAgentForm>(INITIAL_FORM);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await api<Agent[]>("/agents");
      setAgents(data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  async function createAgent() {
    setCreating(true);
    setError(null);
    try {
      await api("/agents", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(INITIAL_FORM);
      setShowForm(false);
      await fetchAgents();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al crear agente");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(agent: Agent) {
    try {
      await api(`/agents/${agent.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !agent.isActive }),
      });
      await fetchAgents();
    } catch {
      setError("No se pudo actualizar el agente");
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Cargando agentes…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Agentes</h1>
        <Button onClick={() => setShowForm((v) => !v)} size="sm">
          <UserPlus className="mr-1 h-4 w-4" />
          Agregar agente
        </Button>
      </div>

      {showForm && (
        <div className="space-y-2 rounded-lg border bg-white p-4">
          <h2 className="font-medium text-slate-700">Nuevo agente</h2>
          <Input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            placeholder="Contraseña (mínimo 6 caracteres)"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "admin" | "agent" }))}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="agent">Agente</option>
            <option value="admin">Admin</option>
          </select>
          <div className="flex gap-2">
            <Button onClick={() => void createAgent()} disabled={creating} className="flex-1">
              {creating ? "Creando…" : "Crear agente"}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-50 p-2 text-sm text-red-600">{error}</p>
      )}

      <div className="space-y-2">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={cn(
              "flex items-center justify-between rounded-xl border bg-white p-4",
              !agent.isActive && "opacity-60"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                {agent.role === "admin" ? (
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                ) : (
                  <User className="h-4 w-4 text-slate-500" />
                )}
              </div>
              <div>
                <p className="font-medium text-slate-800">{agent.name}</p>
                <p className="text-xs text-slate-400">{agent.email}</p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  agent.role === "admin"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-600"
                )}
              >
                {agent.role}
              </span>
              {!agent.isActive && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                  inactivo
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void toggleActive(agent)}
            >
              {agent.isActive ? "Desactivar" : "Activar"}
            </Button>
          </div>
        ))}
        {agents.length === 0 && (
          <div className="rounded-xl border border-dashed bg-white p-8 text-center text-slate-400">
            No hay agentes aún.
          </div>
        )}
      </div>
    </div>
  );
}
