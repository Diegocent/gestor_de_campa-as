import { useState } from "react";
import type { Agent, Conversation } from "@/types";
import { AssignMenu } from "./AssignMenu";
import { Composer } from "./Composer";
import { MessageThread } from "./MessageThread";
import { useMessages } from "./useMessages";
import { ConversationStatusMenu } from "./ConversationStatusMenu";

interface Props {
  conversation: Conversation;
  agents: Agent[];
  onConversationUpdate?: (conversation: Conversation) => void;
}

function clientTitle(c: Conversation): string {
  return (
    c.contactName?.trim() ||
    c.contactPhone?.trim() ||
    c.conversationRef.replace(/@c\.us$/i, "").replace(/@.*$/, "")
  );
}

function clientSubtitle(c: Conversation): string | null {
  const name = c.contactName?.trim();
  if (!name) return null;
  return (
    c.contactPhone?.trim() ||
    c.conversationRef.replace(/@c\.us$/i, "").replace(/@.*$/, "") ||
    null
  );
}

export function ChatPanel({ conversation, agents, onConversationUpdate }: Props) {
  const { messages, loading, send } = useMessages(conversation.id);
  const [currentConversation, setCurrentConversation] = useState(conversation);

  // Sincroniza desde el padre sin perder el nombre del cliente si viene vacío.
  if (conversation.id !== currentConversation.id) {
    setCurrentConversation(conversation);
  } else if (
    conversation.assignedAgentId !== currentConversation.assignedAgentId ||
    conversation.status !== currentConversation.status ||
    (conversation.contactName &&
      conversation.contactName !== currentConversation.contactName)
  ) {
    setCurrentConversation({
      ...conversation,
      contactName: conversation.contactName?.trim()
        ? conversation.contactName
        : currentConversation.contactName,
      contactPhone: conversation.contactPhone?.trim()
        ? conversation.contactPhone
        : currentConversation.contactPhone,
    });
  }

  function updateConversation(next: Conversation) {
    const merged: Conversation = {
      ...next,
      contactName: next.contactName?.trim()
        ? next.contactName
        : currentConversation.contactName,
      contactPhone: next.contactPhone?.trim()
        ? next.contactPhone
        : currentConversation.contactPhone,
    };
    setCurrentConversation(merged);
    onConversationUpdate?.(merged);
  }

  const subtitle = clientSubtitle(currentConversation);

  return (
    <div className="flex h-full flex-1 flex-col bg-slate-50">
      <header className="flex flex-col gap-2 border-b bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-slate-800">
            {clientTitle(currentConversation)}
          </p>
          {subtitle && (
            <p className="truncate text-xs text-slate-400">{subtitle}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ConversationStatusMenu
            conversation={currentConversation}
            onUpdate={updateConversation}
          />
          <AssignMenu
            conversationId={currentConversation.id}
            assignedAgentId={currentConversation.assignedAgentId}
            agents={agents}
            onAssigned={updateConversation}
          />
        </div>
      </header>

      <MessageThread messages={messages} loading={loading} agents={agents} />
      <Composer onSend={send} />
    </div>
  );
}
