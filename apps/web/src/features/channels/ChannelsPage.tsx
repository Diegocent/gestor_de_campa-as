import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Wifi, WifiOff, QrCode, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChannelSession } from "@/types";

const POLL_INTERVAL = 3000;

export function ChannelsPage() {
  const [sessions, setSessions] = useState<ChannelSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restarting, setRestarting] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState<Record<string, string>>({});
  const [pairingCode, setPairingCode] = useState<Record<string, string>>({});
  const [pairingLoading, setPairingLoading] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await api<ChannelSession[]>("/channels/sessions");
      setSessions(data);
    } catch {
      // silencioso en polling
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSessions();
    const id = setInterval(() => void fetchSessions(), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchSessions]);

  async function addSession() {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await api<ChannelSession>("/channels/sessions", {
        method: "POST",
        body: JSON.stringify({ sessionName: newName.trim() }),
      });
      setNewName("");
      setShowAdd(false);
      await fetchSessions();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al agregar sesión");
    } finally {
      setAdding(false);
    }
  }

  async function removeSession(sessionName: string) {
    if (
      !confirm(
        `¿Eliminar el canal "${sessionName}"?\nSe desvinculará de WhatsApp y se borrará del gateway.`
      )
    ) {
      return;
    }
    setRemoving(sessionName);
    setError(null);
    // Optimistic: sacar de la lista al toque
    setSessions((prev) => prev.filter((s) => s.sessionName !== sessionName));
    try {
      await api(`/channels/sessions/${encodeURIComponent(sessionName)}`, { method: "DELETE" });
      await fetchSessions();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo eliminar el canal");
      await fetchSessions();
    } finally {
      setRemoving(null);
    }
  }

  async function restartSession(sessionName: string) {
    setRestarting(sessionName);
    setError(null);
    setPairingCode((prev) => {
      const next = { ...prev };
      delete next[sessionName];
      return next;
    });
    try {
      await api(`/channels/sessions/${encodeURIComponent(sessionName)}/restart`, {
        method: "POST",
      });
      await fetchSessions();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo reiniciar la sesión");
    } finally {
      setRestarting(null);
    }
  }

  async function requestPairing(sessionName: string) {
    const phone = pairingPhone[sessionName]?.trim();
    if (!phone) {
      setError("Ingresá el número a vincular (con código de país, sin +)");
      return;
    }
    setPairingLoading(sessionName);
    setError(null);
    try {
      const res = await api<{ pairingCode: string }>(
        `/channels/sessions/${encodeURIComponent(sessionName)}/pairing-code`,
        {
          method: "POST",
          body: JSON.stringify({ phoneNumber: phone }),
        }
      );
      setPairingCode((prev) => ({ ...prev, [sessionName]: res.pairingCode }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo generar el código");
    } finally {
      setPairingLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Cargando sesiones…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Canales WhatsApp</h1>
        <Button onClick={() => setShowAdd((v) => !v)} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Agregar número
        </Button>
      </div>

      {showAdd && (
        <div className="flex gap-2 rounded-lg border bg-white p-3">
          <Input
            placeholder="Nombre de sesión (ej. ventas)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void addSession()}
            className="flex-1"
          />
          <Button onClick={() => void addSession()} disabled={adding}>
            {adding ? "Creando…" : "Crear"}
          </Button>
          <Button variant="ghost" onClick={() => setShowAdd(false)}>
            Cancelar
          </Button>
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-50 p-2 text-sm text-red-600">{error}</p>
      )}

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-8 text-center text-slate-400">
          No hay sesiones activas. Agregá un número para comenzar.
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div
              key={s.sessionName}
              className="rounded-xl border bg-white p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {s.connected ? (
                    <Wifi className="h-5 w-5 text-green-500" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-slate-400" />
                  )}
                  <div>
                    <p className="font-medium text-slate-800">{s.sessionName}</p>
                    <p className="text-xs text-slate-400">
                      {s.connected
                        ? "Conectado"
                        : s.qr
                        ? "Esperando escaneo de QR"
                        : "Desconectado"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!s.connected && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void restartSession(s.sessionName)}
                      disabled={restarting === s.sessionName}
                      title="Reiniciar y pedir QR nuevo"
                    >
                      <RefreshCw
                        className={`mr-1 h-4 w-4 ${restarting === s.sessionName ? "animate-spin" : ""}`}
                      />
                      Nuevo QR
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void removeSession(s.sessionName)}
                    disabled={removing === s.sessionName}
                    title="Eliminar canal"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {removing === s.sessionName ? "Eliminando…" : "Eliminar"}
                  </Button>
                </div>
              </div>

              {s.qr && !s.connected && (
                <div className="flex flex-col items-center gap-2 rounded-lg bg-slate-50 p-4">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <QrCode className="h-4 w-4" />
                    <span>Escaneá este QR con WhatsApp</span>
                  </div>
                  <img
                    src={s.qr.startsWith("data:") ? s.qr : `data:image/png;base64,${s.qr}`}
                    alt={`QR para ${s.sessionName}`}
                    className="h-48 w-48 rounded-lg bg-white p-2"
                  />
                  <p className="max-w-xs text-center text-xs text-slate-400">
                    WhatsApp → Dispositivos vinculados → Vincular un dispositivo.
                    Escaneá el QR que ves ahora (se renueva solo).
                  </p>
                </div>
              )}

              {!s.connected && (
                <div className="space-y-2 rounded-lg border border-dashed p-3">
                  <p className="text-xs font-medium text-slate-600">
                    Alternativa: vincular con código (sin QR)
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Número con país, ej. 595981234567"
                      value={pairingPhone[s.sessionName] ?? ""}
                      onChange={(e) =>
                        setPairingPhone((prev) => ({
                          ...prev,
                          [s.sessionName]: e.target.value,
                        }))
                      }
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pairingLoading === s.sessionName}
                      onClick={() => void requestPairing(s.sessionName)}
                    >
                      {pairingLoading === s.sessionName ? "…" : "Pedir código"}
                    </Button>
                  </div>
                  {pairingCode[s.sessionName] && (
                    <p className="text-center text-lg font-mono tracking-widest text-slate-800">
                      {pairingCode[s.sessionName]}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">
                    En el celular: Vincular dispositivo → Vincular con número de
                    teléfono → ingresá este código.
                  </p>
                </div>
              )}

              {!s.qr && !s.connected && (
                <p className="text-xs text-slate-400">
                  Esperando QR… También podés abrir{" "}
                  <a
                    href="http://localhost:2785"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline"
                  >
                    el dashboard de OpenWA
                  </a>
                  .
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
