import { createContext, useContext } from "react";
import type { Socket } from "socket.io-client";

export interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

export const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
});

export function useSocketContext(): SocketContextValue {
  return useContext(SocketContext);
}
