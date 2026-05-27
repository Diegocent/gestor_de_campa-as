export interface CampaignPageResult {
  campaigns: import("@/domain/types").Campaign[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const DEFAULT_CAMPAIGNS_PAGE_SIZE = 10;

export function normalizeCampaignPage(page: number, pageSize: number): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize =
    Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 50) : DEFAULT_CAMPAIGNS_PAGE_SIZE;

  return {
    page: safePage,
    pageSize: safePageSize,
    offset: (safePage - 1) * safePageSize,
  };
}

export function buildCampaignPageResult(
  campaigns: import("@/domain/types").Campaign[],
  total: number,
  page: number,
  pageSize: number
): CampaignPageResult {
  const totalPages = total === 0 ? 1 : Math.ceil(total / pageSize);

  return {
    campaigns,
    total,
    page,
    pageSize,
    totalPages,
  };
}
