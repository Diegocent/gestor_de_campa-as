import { api } from "@/lib/api";
import type { Agent, Conversation } from "@/types";
import { AgentChip, findAgent } from "./AgentChip";

interface Props {
  conversationId: string;
  assignedAgentId: string | null;
  agents: Agent[];
  onAssigned: (conversation: Conversation) => void;
}

/** Selector + chip para ver/asignar el gestor del chat. */
export function AssignMenu({ conversationId, assignedAgentId, agents, onAssigned }: Props) {
  const assigned = findAgent(agents, assignedAgentId);

  async function onChange(value: string) {
    const agentId = value === "" ? null : value;
    const updated = await api<Conversation>(`/conversations/${conversationId}/assign`, {
      method: "POST",
      body: JSON.stringify({ agentId }),
    }).catch(() => null);
    if (updated) onAssigned(updated);
  }

  return (
    <div className="flex items-center gap-2">
      <AgentChip agent={assigned} />
      <select
        value={assignedAgentId ?? ""}
        onChange={(e) => void onChange(e.target.value)}
        title="Cambiar gestor asignado"
        aria-label="Asignar gestor"
        className="max-w-[10rem] rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Sin asignar</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}
