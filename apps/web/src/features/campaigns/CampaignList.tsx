import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/types";

const STATUS_LABEL: Record<Campaign["status"], string> = {
  scheduled: "Programada",
  processing: "Enviando",
  completed: "Completada",
  partially_failed: "Con fallos",
  cancelled: "Cancelada",
};

const STATUS_COLOR: Record<Campaign["status"], string> = {
  scheduled: "bg-slate-100 text-slate-600",
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  partially_failed: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};

interface Props {
  campaigns: Campaign[];
  loading: boolean;
  onCancel: (id: string) => void;
}

export function CampaignList({ campaigns, loading, onCancel }: Props) {
  if (loading) return <p className="text-sm text-slate-400">Cargando campañas...</p>;
  if (campaigns.length === 0) return <p className="text-sm text-slate-400">Sin campañas todavía.</p>;

  return (
    <div className="space-y-3">
      {campaigns.map((c) => {
        const done = c.sentCount + c.failedCount;
        const pct = c.totalRecipients > 0 ? Math.round((done / c.totalRecipients) * 100) : 0;
        const active = c.status === "scheduled" || c.status === "processing";
        return (
          <div key={c.id} className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-800">{c.title}</p>
              <span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS_COLOR[c.status])}>
                {STATUS_LABEL[c.status]}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>
                {c.sentCount} enviados · {c.failedCount} fallidos · {c.totalRecipients} total
              </span>
              {active && (
                <Button variant="outline" size="sm" onClick={() => onCancel(c.id)}>
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
