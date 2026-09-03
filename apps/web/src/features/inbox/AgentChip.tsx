import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types";

interface Props {
  agent: Agent | null | undefined;
  /** Si true, estilo más chico para la lista lateral. */
  compact?: boolean;
  className?: string;
}

/**
 * Chip que identifica al gestor asignado al chat (nunca reemplaza al cliente).
 */
export function AgentChip({ agent, compact = false, className }: Props) {
  if (!agent) {
    return (
      <span
        title="Sin gestor asignado"
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 bg-slate-50 text-slate-400",
          compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
          className
        )}
      >
        <UserRound className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        Sin gestor
      </span>
    );
  }

  const initials = agent.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  return (
    <span
      title={`Gestor: ${agent.name} · ${agent.email}${agent.role === "admin" ? " · Admin" : " · Agente"}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 text-sky-800",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs font-medium",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded bg-sky-600 font-semibold text-white",
          compact ? "h-4 w-4 text-[9px]" : "h-5 w-5 text-[10px]"
        )}
      >
        {initials || "?"}
      </span>
      <span className="truncate">
        {compact ? agent.name : `Gestor: ${agent.name}`}
      </span>
    </span>
  );
}

export function findAgent(agents: Agent[], agentId: string | null | undefined): Agent | null {
  if (!agentId) return null;
  return agents.find((a) => a.id === agentId) ?? null;
}
