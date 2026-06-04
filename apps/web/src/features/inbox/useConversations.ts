import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Conversation, NewMessageEvent, Paginated } from "@/types";
import { useSocketContext } from "../realtime/socket-context";

function upsertAndSort(list: Conversation[], next: Conversation): Conversation[] {
  const without = list.filter((c) => c.id !== next.id);
  return [next, ...without].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );
}

export function useConversations() {
  const { socket, connected } = useSocketContext();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api<Paginated<Conversation>>("/conversations?page=1&pageSize=50");
    setConversations(res.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Reordenamiento dinámico: cada mensaje nuevo sube su conversación al tope.
  useEffect(() => {
    if (!socket) return;
    const onNew = (evt: NewMessageEvent) =>
      setConversations((prev) => upsertAndSort(prev, evt.conversation));
    const onUpdate = (evt: { conversation: Conversation }) =>
      setConversations((prev) => upsertAndSort(prev, evt.conversation));

    socket.on("message:new", onNew);
    socket.on("conversation:update", onUpdate);
    return () => {
      socket.off("message:new", onNew);
      socket.off("conversation:update", onUpdate);
    };
  }, [socket, connected]);

  const markRead = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
    void api(`/conversations/${id}/read`, { method: "POST" }).catch(() => undefined);
  }, []);

  return { conversations, loading, connected, reload: load, markRead };
}
