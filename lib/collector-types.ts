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
  status: "ok" | "degraded";
  owner?: string | null;
  last_collection?: {
    collected_at?: string;
    repo_count?: number;
  } | null;
  db_stats?: {
    ready?: boolean;
    latest_snapshot_date?: string | null;
    snapshots_count?: number;
    referrer_rows?: number;
    repos_with_history?: number;
    db_error?: boolean;
  } | null;
};

export type CollectorStatus = {
  configured: boolean;
  reachable: boolean;
  configuredOwner: string | null;
  lastCollectionAt: string | null;
  repoCount: number | null;
  dbReady: boolean;
  latestSnapshotDate: string | null;
  snapshotsCount: number | null;
  referrerRows: number | null;
  reposWithHistory: number | null;
  dbError: boolean | null;
};
