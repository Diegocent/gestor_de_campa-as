import { Virtuoso } from "react-virtuoso";
import type { Message } from "@/types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: Message[];
  loading: boolean;
}

/**
 * Hilo de mensajes virtualizado con react-virtuoso: maneja alturas dinámicas y
 * auto-scroll al final (followOutput), renderizando sólo lo visible para no
 * colapsar el navegador con historiales masivos.
 */
export function MessageThread({ messages, loading }: Props) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
        Cargando mensajes...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
        No hay mensajes todavía.
      </div>
    );
  }

  return (
    <Virtuoso
      className="flex-1"
      data={messages}
      followOutput="smooth"
      initialTopMostItemIndex={messages.length - 1}
      itemContent={(_index, message) => <MessageBubble message={message} />}
    />
  );
}
