import { useMemo, useState } from "react";
import { useContainerHeight } from "@/hooks/useContainerHeight";
import type { Conversation } from "@/types";
import { QrPanel } from "../channel/QrPanel";
import { useChannelStatus } from "../channel/useChannelStatus";
import { ConversationList } from "./ConversationList";
import { ChatPanel } from "./ChatPanel";
import { NewConversationDialog } from "./NewConversationDialog";
import { useAgents } from "./useAgents";
import { useConversations } from "./useConversations";

export function InboxPage() {
  const { conversations, loading, markRead, reload, patchConversation } = useConversations();
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

  async function onCreated(conversation: Conversation) {
    await reload();
    setSelectedId(conversation.id);
  }

  return (
    <div className="flex h-full flex-col">
      {!channel.connected && (
        <div className="bg-amber-50 px-4 py-2 text-center text-xs text-amber-700">
          WhatsApp no está vinculado. Escaneá el código QR para empezar a recibir mensajes.
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-80 flex-col border-r bg-white">
          <NewConversationDialog onCreated={(c) => void onCreated(c)} />
          <div ref={ref} className="min-h-0 flex-1">
            {loading ? (
              <p className="p-4 text-sm text-slate-400">Cargando conversaciones...</p>
            ) : conversations.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">
                Aún no hay conversaciones. Iniciá una con el botón de arriba.
              </p>
            ) : (
              <ConversationList
                conversations={conversations}
                agents={agents}
                selectedId={selectedId}
                onSelect={(c) => onSelect(c.id, c.unreadCount)}
                height={Math.max(height, 200)}
              />
            )}
          </div>
        </aside>

        <main className="flex flex-1 overflow-hidden">
          {selected ? (
            <ChatPanel
              conversation={selected}
              agents={agents}
              onConversationUpdate={patchConversation}
            />
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
