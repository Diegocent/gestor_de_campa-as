import { useCallback, useEffect, useState } from "react";
import { api, tokenStore } from "@/lib/api";
import type { Agent, AuthTokens } from "@/types";
import { AuthContext } from "./auth-context";

interface LoginResponse {
  agent: Agent;
  tokens: AuthTokens;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.access) {
      setLoading(false);
      return;
    }
    api<Agent>("/auth/me")
      .then(setAgent)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    tokenStore.set(res.tokens.accessToken, res.tokens.refreshToken);
    setAgent(res.agent);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setAgent(null);
  }, []);

  return (
    <AuthContext.Provider value={{ agent, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
