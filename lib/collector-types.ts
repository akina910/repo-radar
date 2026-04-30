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
  kv_error?: boolean;
  runtime_config_visible?: boolean;
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
  runtime_config?: {
    github_username_configured?: boolean;
    github_token_configured?: boolean;
    api_secret_configured?: boolean;
    d1_binding_configured?: boolean;
    kv_binding_configured?: boolean;
  } | null;
};

export type CollectorStatus = {
  configured: boolean;
  reachable: boolean;
  status: "ok" | "degraded" | null;
  configuredOwner: string | null;
  lastCollectionAt: string | null;
  repoCount: number | null;
  dbReady: boolean;
  latestSnapshotDate: string | null;
  snapshotsCount: number | null;
  referrerRows: number | null;
  reposWithHistory: number | null;
  dbError: boolean | null;
  kvError: boolean | null;
  runtimeGithubUsernameConfigured: boolean | null;
  runtimeGithubTokenConfigured: boolean | null;
  runtimeApiSecretConfigured: boolean | null;
  runtimeD1BindingConfigured: boolean | null;
  runtimeKvBindingConfigured: boolean | null;
};

export type CollectorSyncConfig = {
  workerUrlConfigured: boolean;
  apiSecretConfigured: boolean;
  triggerTokenConfigured: boolean;
  triggerTokenSource: "dedicated" | "api_secret_fallback" | "missing";
  manualSyncReady: boolean;
};
