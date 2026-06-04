import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AckEvent, Message, NewMessageEvent, Paginated } from "@/types";
import { useSocketContext } from "../realtime/socket-context";

/**
 * Estado del hilo de una conversación: carga el historial y se mantiene en vivo
 * por WebSocket (mensajes nuevos + acuses de recibo). Separa la lógica de estado
 * de la presentación (MessageThread sólo renderiza).
 */
export function useMessages(conversationId: string | null) {
  const { socket } = useSocketContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api<Paginated<Message>>(`/conversations/${conversationId}/messages?page=1&pageSize=50`)
      .then((res) => {
        if (!cancelled) setMessages(res.items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    if (!socket || !conversationId) return;

    const onNew = (evt: NewMessageEvent) => {
      if (evt.message.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.some((m) => m.id === evt.message.id) ? prev : [...prev, evt.message]
      );
    };
    const onAck = (ack: AckEvent) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.providerMessageId && m.providerMessageId === ack.providerMessageId
            ? { ...m, status: ack.status }
            : m
        )
      );
    };

    socket.on("message:new", onNew);
    socket.on("message:ack", onAck);
    return () => {
      socket.off("message:new", onNew);
      socket.off("message:ack", onAck);
    };
  }, [socket, conversationId]);

  const send = useCallback(
    async (text: string) => {
      if (!conversationId || !text.trim()) return;
      await api(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
    },
    [conversationId]
  );

  return { messages, loading, send };
}
