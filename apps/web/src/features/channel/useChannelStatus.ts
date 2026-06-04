import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ChannelStateEvent } from "@/types";
import { useSocketContext } from "../realtime/socket-context";

interface ChannelStatus {
  connected: boolean;
  qr: string | null;
  state: string;
}

/** Estado del canal de WhatsApp (conexión + QR), en vivo por WebSocket. */
export function useChannelStatus() {
  const { socket } = useSocketContext();
  const [status, setStatus] = useState<ChannelStatus>({
    connected: false,
    qr: null,
    state: "initializing",
  });

  useEffect(() => {
    api<{ qr: string | null; connected: boolean }>("/channel/qr")
      .then((res) =>
        setStatus((s) => ({ ...s, qr: res.qr, connected: res.connected }))
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onState = (evt: ChannelStateEvent) =>
      setStatus({
        state: evt.state,
        qr: evt.qr,
        connected: evt.state === "connected",
      });
    socket.on("channel:state", onState);
    return () => {
      socket.off("channel:state", onState);
    };
  }, [socket]);

  return status;
}
