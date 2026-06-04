import { api } from "@/lib/api";
import type { Agent } from "@/types";

interface Props {
  conversationId: string;
  assignedAgentId: string | null;
  agents: Agent[];
}

/** Selector para asignar la conversación a un agente. */
export function AssignMenu({ conversationId, assignedAgentId, agents }: Props) {
  async function onChange(value: string) {
    const agentId = value === "" ? null : value;
    await api(`/conversations/${conversationId}/assign`, {
      method: "POST",
      body: JSON.stringify({ agentId }),
    }).catch(() => undefined);
  }

  return (
    <select
      value={assignedAgentId ?? ""}
      onChange={(e) => void onChange(e.target.value)}
      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Sin asignar</option>
      {agents.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}
