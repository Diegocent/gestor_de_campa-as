import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Agent } from "@/types";

/** Lista de agentes de la organización (para asignar conversaciones). */
export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    api<Agent[]>("/agents")
      .then(setAgents)
      .catch(() => setAgents([]));
  }, []);

  return agents;
}
