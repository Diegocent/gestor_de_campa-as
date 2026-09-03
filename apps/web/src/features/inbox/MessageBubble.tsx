import { Check, CheckCheck, Clock, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent, Message } from "@/types";
import { findAgent } from "./AgentChip";

function StatusIcon({ status }: { status: Message["status"] }) {
  if (status === "queued") return <Clock className="h-3 w-3 opacity-70" />;
  if (status === "read") return <CheckCheck className="h-3 w-3 text-sky-300" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 opacity-80" />;
  if (status === "failed") return <span className="text-red-300">✕</span>;
  return <Check className="h-3 w-3 opacity-80" />;
}

function mediaSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("data:") || url.startsWith("blob:")) return url;
  return url.startsWith("/") ? url : `/${url}`;
}

interface Props {
  message: Message;
  agents: Agent[];
}

export function MessageBubble({ message, agents }: Props) {
  const outbound = message.direction === "outbound";
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const src = mediaSrc(message.mediaUrl);
  const isImage =
    message.type === "image" || (message.mediaMimeType?.startsWith("image/") ?? false);
  const isVideo =
    message.type === "video" || (message.mediaMimeType?.startsWith("video/") ?? false);
  const isAudio =
    message.type === "audio" || (message.mediaMimeType?.startsWith("audio/") ?? false);
  const sender = outbound ? findAgent(agents, message.sentByAgentId) : null;

  return (
    <div className={cn("flex px-4 py-1", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          outbound ? "bg-blue-600 text-white" : "bg-white text-slate-800"
        )}
      >
        {sender && (
          <p
            title={`${sender.name} · ${sender.email}`}
            className="mb-1 text-[10px] font-semibold tracking-wide text-blue-100"
          >
            Gestor: {sender.name}
          </p>
        )}
        {src && isImage && (
          <a href={src} target="_blank" rel="noreferrer" className="mb-2 block">
            <img
              src={src}
              alt={message.mediaFilename ?? "imagen"}
              className="max-h-64 max-w-full rounded-lg object-contain"
            />
          </a>
        )}
        {src && isVideo && (
          <video src={src} controls className="mb-2 max-h-64 max-w-full rounded-lg" />
        )}
        {src && isAudio && <audio src={src} controls className="mb-2 w-full" />}
        {src && !isImage && !isVideo && !isAudio && (
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "mb-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs underline",
              outbound ? "bg-blue-500/40 text-white" : "bg-slate-100 text-slate-700"
            )}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">{message.mediaFilename ?? "Archivo"}</span>
          </a>
        )}
        {message.text && (
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        )}
        {!message.text && !src && (
          <p className="italic opacity-70">[{message.type}]</p>
        )}
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
