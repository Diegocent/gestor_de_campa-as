import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";

type ConversationStatus = Conversation["status"];

const STATUS_LABELS: Record<ConversationStatus, string> = {
  open: "Abierta",
  pending: "Pendiente",
  resolved: "Resuelta",
  snoozed: "Pospuesta",
};

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: "text-green-700 bg-green-50 border-green-200",
  pending: "text-yellow-700 bg-yellow-50 border-yellow-200",
  resolved: "text-slate-600 bg-slate-100 border-slate-200",
  snoozed: "text-purple-700 bg-purple-50 border-purple-200",
};

const ALL_STATUSES: ConversationStatus[] = ["open", "pending", "resolved", "snoozed"];

interface Props {
  conversation: Conversation;
  onUpdate: (updated: Conversation) => void;
}

export function ConversationStatusMenu({ conversation, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function changeStatus(status: ConversationStatus) {
    if (status === conversation.status) {
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const updated = await api<Conversation>(
        `/conversations/${conversation.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }
      );
      onUpdate(updated);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        className={cn(
          "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
          STATUS_COLORS[conversation.status]
        )}
      >
        {STATUS_LABELS[conversation.status]}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border bg-white py-1 shadow-lg">
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => void changeStatus(s)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50",
                  s === conversation.status && "font-medium text-blue-600"
                )}
              >
                {STATUS_LABELS[s]}
                {s === conversation.status && (
                  <span className="ml-auto text-blue-600">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
