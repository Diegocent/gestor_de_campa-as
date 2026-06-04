import { useState } from "react";
import { useAuth } from "./features/auth/auth-context";
import { LoginPage } from "./features/auth/LoginPage";
import { InboxPage } from "./features/inbox/InboxPage";
import { CampaignsPage } from "./features/campaigns/CampaignsPage";
import { SocketProvider } from "./features/realtime/SocketProvider";
import { AppShell, type AppView } from "./features/shell/AppShell";

export function App() {
  const { agent, loading } = useAuth();
  const [view, setView] = useState<AppView>("inbox");

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
        Cargando...
      </div>
    );
  }

  if (!agent) return <LoginPage />;

  return (
    <SocketProvider>
      <AppShell view={view} onView={setView}>
        {view === "inbox" ? <InboxPage /> : <CampaignsPage />}
      </AppShell>
    </SocketProvider>
  );
}
