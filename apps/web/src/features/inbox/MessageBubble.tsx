import { Check, CheckCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

function StatusIcon({ status }: { status: Message["status"] }) {
  if (status === "queued") return <Clock className="h-3 w-3 opacity-70" />;
  if (status === "read") return <CheckCheck className="h-3 w-3 text-sky-300" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 opacity-80" />;
  if (status === "failed") return <span className="text-red-300">✕</span>;
  return <Check className="h-3 w-3 opacity-80" />;
}

export function MessageBubble({ message }: { message: Message }) {
  const outbound = message.direction === "outbound";
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={cn("flex px-4 py-1", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          outbound ? "bg-blue-600 text-white" : "bg-white text-slate-800"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[10px]",
            outbound ? "text-blue-100" : "text-slate-400"
          )}
        >
          <span>{time}</span>
          {outbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}
