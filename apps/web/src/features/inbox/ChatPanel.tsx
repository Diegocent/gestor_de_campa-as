import type { Agent, Conversation } from "@/types";
import { AssignMenu } from "./AssignMenu";
import { Composer } from "./Composer";
import { MessageThread } from "./MessageThread";
import { useMessages } from "./useMessages";

interface Props {
  conversation: Conversation;
  agents: Agent[];
}

export function ChatPanel({ conversation, agents }: Props) {
  const { messages, loading, send } = useMessages(conversation.id);

  return (
    <div className="flex h-full flex-1 flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3">
        <div>
          <p className="font-medium text-slate-800">
            {conversation.conversationRef.replace("@c.us", "")}
          </p>
          <p className="text-xs capitalize text-slate-400">{conversation.status}</p>
        </div>
        <AssignMenu
          conversationId={conversation.id}
          assignedAgentId={conversation.assignedAgentId}
          agents={agents}
        />
      </header>

      <MessageThread messages={messages} loading={loading} />
      <Composer onSend={send} />
    </div>
  );
}
