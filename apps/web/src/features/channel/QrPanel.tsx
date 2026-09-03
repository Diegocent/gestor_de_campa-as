interface Props {
  qr: string | null;
  state: string;
}

function toSrc(qr: string): string {
  return qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`;
}

/** Pantalla de vinculación: muestra el QR de WhatsApp cuando hace falta. */
export function QrPanel({ qr, state }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold">Vinculá WhatsApp</h2>
      {qr ? (
        <>
          <img
            src={toSrc(qr)}
            alt="Código QR de WhatsApp"
            className="h-64 w-64 rounded-lg border bg-white p-2"
          />
          <p className="max-w-sm text-sm text-slate-500">
            Abrí WhatsApp → Dispositivos vinculados → Vincular un dispositivo y
            escaneá este código. Se renueva solo cada ~20s: usá el que ves ahora.
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-500">
          {state === "connected"
            ? "Conectado."
            : "Esperando el código QR del servidor..."}
        </p>
      )}
    </div>
  );
}
