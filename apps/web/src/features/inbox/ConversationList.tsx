import { FixedSizeList, type ListChildComponentProps } from "react-window";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";

interface RowData {
  items: Conversation[];
  selectedId: string | null;
  onSelect: (c: Conversation) => void;
}

const ROW_HEIGHT = 72;

function Row({ index, style, data }: ListChildComponentProps<RowData>) {
  const conv = data.items[index]!;
  const active = conv.id === data.selectedId;
  return (
    <div style={style} className="px-2">
      <button
        onClick={() => data.onSelect(conv)}
        className={cn(
          "flex h-[68px] w-full flex-col justify-center gap-1 rounded-lg border-b px-3 text-left transition-colors",
          active ? "bg-blue-50" : "hover:bg-slate-50"
        )}
      >
        <div className="flex items-center justify-between">
          <span className="truncate font-medium text-slate-800">
            {conv.conversationRef.replace("@c.us", "")}
          </span>
          {conv.unreadCount > 0 && (
            <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
              {conv.unreadCount}
            </span>
          )}
        </div>
        <span className="truncate text-sm text-slate-500">
          {conv.lastMessagePreview ?? "Sin mensajes"}
        </span>
      </button>
    </div>
  );
}

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (c: Conversation) => void;
  height: number;
}

/**
 * Virtualiza la lista: solo renderiza las filas visibles en el viewport,
 * evitando que el navegador colapse con miles de conversaciones.
 */
export function ConversationList({ conversations, selectedId, onSelect, height }: Props) {
  return (
    <FixedSizeList
      height={height}
      width="100%"
      itemCount={conversations.length}
      itemSize={ROW_HEIGHT}
      itemData={{ items: conversations, selectedId, onSelect }}
    >
      {Row}
    </FixedSizeList>
  );
}
