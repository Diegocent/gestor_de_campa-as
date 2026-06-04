import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Campaign, Paginated } from "@/types";

export interface CreateCampaignData {
  title: string;
  messageBody: string;
  scheduledAt: string;
  file: File;
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await api<Paginated<Campaign>>("/campaigns?page=1&pageSize=20");
    setCampaigns(res.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(
    async (data: CreateCampaignData) => {
      const form = new FormData();
      form.append("title", data.title);
      form.append("messageBody", data.messageBody);
      form.append("scheduledAt", data.scheduledAt);
      form.append("file", data.file);
      await api("/campaigns", { method: "POST", body: form });
      await reload();
    },
    [reload]
  );

  const cancel = useCallback(
    async (id: string) => {
      await api(`/campaigns/${id}/cancel`, { method: "POST" });
      await reload();
    },
    [reload]
  );

  return { campaigns, loading, reload, create, cancel };
}
