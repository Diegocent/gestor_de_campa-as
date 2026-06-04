import { Inbox, LogOut, Megaphone, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "../auth/auth-context";
import { useSocketContext } from "../realtime/socket-context";

export type AppView = "inbox" | "campaigns";

interface Props {
  view: AppView;
  onView: (v: AppView) => void;
  children: React.ReactNode;
}

const TABS: { id: AppView; label: string; icon: typeof Inbox }[] = [
  { id: "inbox", label: "Bandeja", icon: Inbox },
  { id: "campaigns", label: "Campañas", icon: Megaphone },
];

export function AppShell({ view, onView, children }: Props) {
  const { agent, logout } = useAuth();
  const { connected } = useSocketContext();

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white px-4 py-2">
        <nav className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onView(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === tab.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {connected ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-slate-400" />
          )}
          <span className="text-sm text-slate-600">{agent?.name}</span>
          <Button variant="ghost" size="icon" onClick={logout} title="Salir">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
