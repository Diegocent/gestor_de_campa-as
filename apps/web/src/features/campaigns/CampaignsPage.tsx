import { Button } from "@/components/ui/button";
import { CampaignForm } from "./CampaignForm";
import { CampaignList } from "./CampaignList";
import { SendRateSettings } from "./SendRateSettings";
import { useCampaigns } from "./useCampaigns";

export function CampaignsPage() {
  const { campaigns, loading, reload, create, cancel } = useCampaigns();

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Campañas</h1>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              Actualizar
            </Button>
          </div>
          <CampaignList campaigns={campaigns} loading={loading} onCancel={(id) => void cancel(id)} />
        </section>

        <aside className="space-y-4">
          <CampaignForm onCreate={create} />
          <SendRateSettings />
        </aside>
      </div>
    </div>
  );
}
