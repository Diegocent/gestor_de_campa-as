import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { cn } from "@/lib/utils";
import type { Agent, Conversation } from "@/types";
import { AgentChip, findAgent } from "./AgentChip";

interface RowData {
  items: Conversation[];
  agents: Agent[];
  selectedId: string | null;
  onSelect: (c: Conversation) => void;
}

const ROW_HEIGHT = 84;

function displayName(conv: Conversation): string {
  const name = conv.contactName?.trim();
  if (name) return name;
  const phone = conv.contactPhone?.trim();
  if (phone) return phone;
  return conv.conversationRef.replace(/@c\.us$/i, "").replace(/@.*$/, "");
}

function displaySubtitle(conv: Conversation): string | null {
  const name = conv.contactName?.trim();
  if (!name) return null;
  const phone = conv.contactPhone?.trim();
  if (phone) return phone;
  const ref = conv.conversationRef.replace(/@c\.us$/i, "").replace(/@.*$/, "");
  return ref !== name ? ref : null;
}

function Row({ index, style, data }: ListChildComponentProps<RowData>) {
  const conv = data.items[index]!;
  const active = conv.id === data.selectedId;
  const unread = conv.unreadCount > 0;
  const subtitle = displaySubtitle(conv);
  const agent = findAgent(data.agents, conv.assignedAgentId);
  return (
    <div style={style} className="px-2 py-0.5">
      <button
        onClick={() => data.onSelect(conv)}
        className={cn(
          "flex h-[76px] w-full flex-col justify-center gap-0.5 rounded-lg border px-3 text-left transition-colors",
          active && "border-blue-200 bg-blue-50",
          !active && unread && "border-sky-100/80 bg-sky-50/70 hover:bg-sky-50",
          !active && !unread && "border-transparent hover:bg-slate-50"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "min-w-0 truncate text-slate-800",
              unread ? "font-semibold" : "font-medium"
            )}
          >
            {displayName(conv)}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {agent && <AgentChip agent={agent} compact />}
            {unread && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                {conv.unreadCount}
              </span>
            )}
          </div>
        </div>
        {subtitle && <span className="truncate text-xs text-slate-400">{subtitle}</span>}
        <span
          className={cn(
            "truncate text-sm",
            unread ? "font-medium text-slate-600" : "text-slate-500"
          )}
        >
          {conv.lastMessagePreview ?? "Sin mensajes"}
        </span>
      </button>
    </div>
  );
}

interface Props {
  conversations: Conversation[];
  agents: Agent[];
  selectedId: string | null;
  onSelect: (c: Conversation) => void;
  height: number;
}

/**
 * Virtualiza la lista: solo renderiza las filas visibles en el viewport,
 * evitando que el navegador colapse con miles de conversaciones.
 */
export function ConversationList({
  conversations,
  agents,
  selectedId,
  onSelect,
  height,
}: Props) {
  return (
    <FixedSizeList
      height={height}
      width="100%"
      itemCount={conversations.length}
      itemSize={ROW_HEIGHT}
      itemData={{ items: conversations, agents, selectedId, onSelect }}
    >
      {Row}
    </FixedSizeList>
  );
}
