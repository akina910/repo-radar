export type TrafficDay = {
  date: string;
  views_count: number;
  views_uniques: number;
  clones_count: number;
  clones_uniques: number;
};

export type ReferrerSummary = {
  referrer: string;
  total_count: number;
  last_seen: string;
};

export type CollectorStatusPayload = {
  status: "ok";
  last_collection: {
    collected_at: string;
    repo_count: number;
  } | null;
};

export type CollectorStatus = {
  configured: boolean;
  reachable: boolean;
  lastCollectionAt: string | null;
  repoCount: number | null;
};
