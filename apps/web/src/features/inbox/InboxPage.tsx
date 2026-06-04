import { useMemo, useState } from "react";
import { useContainerHeight } from "@/hooks/useContainerHeight";
import { QrPanel } from "../channel/QrPanel";
import { useChannelStatus } from "../channel/useChannelStatus";
import { ConversationList } from "./ConversationList";
import { ChatPanel } from "./ChatPanel";
import { useAgents } from "./useAgents";
import { useConversations } from "./useConversations";

export function InboxPage() {
  const { conversations, loading, markRead } = useConversations();
  const channel = useChannelStatus();
  const agents = useAgents();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { ref, height } = useContainerHeight<HTMLDivElement>();

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  function onSelect(id: string, unread: number) {
    setSelectedId(id);
    if (unread > 0) markRead(id);
  }

  return (
    <div className="flex h-full flex-col">
      {!channel.connected && (
        <div className="bg-amber-50 px-4 py-2 text-center text-xs text-amber-700">
          WhatsApp no está vinculado. Escaneá el código QR para empezar a recibir mensajes.
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <aside ref={ref} className="w-80 border-r bg-white">
          {loading ? (
            <p className="p-4 text-sm text-slate-400">Cargando conversaciones...</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">Aún no hay conversaciones.</p>
          ) : (
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={(c) => onSelect(c.id, c.unreadCount)}
              height={height}
            />
          )}
        </aside>

        <main className="flex flex-1 overflow-hidden">
          {selected ? (
            <ChatPanel conversation={selected} agents={agents} />
          ) : !channel.connected ? (
            <QrPanel qr={channel.qr} state={channel.state} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-slate-400">
              Seleccioná una conversación
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
