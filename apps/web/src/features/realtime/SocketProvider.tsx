import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { tokenStore } from "@/lib/api";
import { SocketContext } from "./socket-context";

// En producción normalmente servimos backend y frontend bajo el mismo host
// (ej. con nginx). En ese caso, es mejor apuntar al mismo origen.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;

/**
 * Provee UNA sola conexión WebSocket (socket.io) autenticada con el access
 * token JWT para toda la app. Todos los hooks de feature comparten este socket.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = tokenStore.access;
    if (!token) return;

    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
    });
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}
