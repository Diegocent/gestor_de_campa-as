import { useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface ComposerAttachment {
  file: File;
  previewUrl?: string;
}

interface Props {
  onSend: (payload: { text?: string; file?: File }) => Promise<void>;
  disabled?: boolean;
}

export function Composer({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<ComposerAttachment | null>(null);
  const [sending, setSending] = useState(false);

  function clearAttachment() {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
  }

  function onPickFile(file: File | undefined) {
    if (!file) return;
    clearAttachment();
    const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
    setAttachment({ file, previewUrl });
  }

  async function submit() {
    const value = text.trim();
    if ((!value && !attachment) || sending) return;
    setSending(true);
    const pendingText = value;
    const pendingFile = attachment?.file;
    setText("");
    clearAttachment();
    try {
      await onSend({ text: pendingText || undefined, file: pendingFile });
    } catch {
      setText(pendingText);
      if (pendingFile) onPickFile(pendingFile);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div className="space-y-2 border-t bg-white p-3">
      {attachment && (
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {attachment.previewUrl ? (
            <img
              src={attachment.previewUrl}
              alt="Vista previa"
              className="h-12 w-12 rounded object-cover"
            />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
          <span className="flex-1 truncate">{attachment.file.name}</span>
          <button
            type="button"
            onClick={clearAttachment}
            className="rounded p-1 hover:bg-slate-200"
            title="Quitar archivo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <label className="cursor-pointer rounded-md p-2 text-slate-500 hover:bg-slate-100">
          <Paperclip className="h-5 w-5" />
          <input
            type="file"
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            onChange={(e) => onPickFile(e.target.files?.[0])}
            disabled={disabled || sending}
          />
        </label>
        <Textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            attachment
              ? "Caption opcional… (Enter para enviar)"
              : "Escribí un mensaje… (Enter para enviar)"
          }
          disabled={disabled || sending}
          className="max-h-32 min-h-[40px]"
        />
        <Button
          size="icon"
          onClick={() => void submit()}
          disabled={disabled || sending || (!text.trim() && !attachment)}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
