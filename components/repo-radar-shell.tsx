"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Moon, Search, Sun, TrendingUp } from "lucide-react";

import { RepoRadar, type RadarRepo } from "@/components/repo-radar";
import type { CollectorStatus, CollectorSyncConfig } from "@/lib/collector-types";

type Locale = "en" | "ja";
type Theme = "light" | "dark";

const COPY = {
  en: {
    title: "Repo Radar",
    hero: "See which repositories are quietly getting traction.",
    description:
      "A lightweight dashboard for GitHub repositories. It focuses on repo-level attention, not generic analytics noise.",
    language: "Language",
    theme: "Theme",
    tracking: "GitHub username",
    usernamePlaceholder: "Enter GitHub username",
    load: "Load",
    collectorHistoryOn: "90-day collector",
    collectorDirect: "GitHub direct mode",
    collectorUnavailable: "Collector unreachable",
    collectorDegraded: "Collector degraded",
    collectorSetupNeeded: "Collector not configured",
    collectorWaiting: "Collector ready, waiting for first sync",
    collectorOwner: "Collector owner",
    lastSync: "Last sync",
    latestData: "Latest data",
    syncedRepos: "Synced repos",
    reposWithHistory: "Repos with history",
    syncCollector: "Sync collector",
    syncingCollector: "Syncing…",
    syncReady: "Trigger a manual sync once secrets and Vercel envs are set.",
    syncMissingWorkerUrl:
      "Set NEXT_PUBLIC_COLLECTOR_URL on Vercel so the app can reach the Worker.",
    syncMissingApiSecret:
      "Set COLLECTOR_API_SECRET on Vercel so the server can trigger the collector.",
    syncMissingTriggerToken:
      "Set COLLECTOR_TRIGGER_TOKEN on Vercel so browser unlock can enable manual sync.",
    syncUnlockHelp: "Manual sync is protected. Enter the trigger token to enable it in this browser.",
    syncTokenLabel: "Trigger token",
    syncTokenPlaceholder: "Enter trigger token",
    unlockCollector: "Unlock sync",
    unlockingCollector: "Unlocking…",
    syncUnlockSuccess: "Manual sync unlocked for this browser.",
    syncSessionExpired: "Manual sync session expired. Unlock it again.",
    syncTokenRequired: "Trigger token is required.",
    syncSuccess: "Collector sync finished.",
    syncError: "Collector sync failed.",
    emptyTitle: "No repositories loaded yet.",
    emptyDescription:
      "Add your GitHub username in the environment file and restart the app. This first version keeps the scope intentionally small.",
  },
  ja: {
    title: "Repo Radar",
    hero: "どのリポジトリに静かに反応が集まっているかを一目で見る。",
    description:
      "GitHub リポジトリを見るための軽量ダッシュボードです。一般的な analytics ではなく、リポジトリごとの反応に絞ります。",
    language: "言語",
    theme: "テーマ",
    tracking: "GitHubユーザー",
    usernamePlaceholder: "GitHubユーザー名を入力",
    load: "読み込む",
    collectorHistoryOn: "90日 collector",
    collectorDirect: "GitHub 直取得モード",
    collectorUnavailable: "Collector に到達できません",
    collectorDegraded: "Collector の状態が不完全です",
    collectorSetupNeeded: "Collector 未設定",
    collectorWaiting: "Collector は有効で、初回同期待ちです",
    collectorOwner: "Collector対象",
    lastSync: "最終同期",
    latestData: "最新データ日",
    syncedRepos: "同期済みrepo数",
    reposWithHistory: "履歴ありrepo数",
    syncCollector: "Collector同期",
    syncingCollector: "同期中…",
    syncReady: "secret と Vercel env を設定したら、手動同期を一度実行できます。",
    syncMissingWorkerUrl:
      "アプリから Worker に到達できるよう、Vercel に NEXT_PUBLIC_COLLECTOR_URL を設定してください。",
    syncMissingApiSecret:
      "サーバーから collector を叩けるよう、Vercel に COLLECTOR_API_SECRET を設定してください。",
    syncMissingTriggerToken:
      "ブラウザで手動同期を有効化できるよう、Vercel に COLLECTOR_TRIGGER_TOKEN を設定してください。",
    syncUnlockHelp: "手動同期は保護されています。このブラウザで有効にするには trigger token を入力してください。",
    syncTokenLabel: "Trigger token",
    syncTokenPlaceholder: "trigger token を入力",
    unlockCollector: "同期を有効化",
    unlockingCollector: "有効化中…",
    syncUnlockSuccess: "このブラウザで手動同期を有効化しました。",
    syncSessionExpired: "手動同期セッションの期限が切れました。もう一度有効化してください。",
    syncTokenRequired: "Trigger token は必須です。",
    syncSuccess: "Collector 同期が完了しました。",
    syncError: "Collector 同期に失敗しました。",
    emptyTitle: "まだリポジトリが読み込まれていません。",
    emptyDescription:
      "環境変数に GitHub ユーザー名を入れて、アプリを再起動してください。最初の版は意図的に小さくしています。",
  },
} as const;

type TriggerResponsePayload = {
  ok?: boolean;
  error?: string;
  details?: { error?: string; raw?: string } | string | null;
  raw?: string;
  authenticated?: boolean;
};

function formatCollectorTimestamp(dateString: string, locale: Locale) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleString(locale === "ja" ? "ja-JP" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

async function readResponsePayload(response: Response): Promise<TriggerResponsePayload | null> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text) as TriggerResponsePayload;
    } catch {
      return { raw: text };
    }
  }

  return { raw: text };
}

function readTriggerErrorMessage(payload: TriggerResponsePayload | null, fallback: string) {
  if (!payload) {
    return fallback;
  }

  if (payload.details && typeof payload.details === "object" && payload.details.error) {
    return payload.details.error;
  }

  if (typeof payload.details === "string") {
    return payload.details;
  }

  return payload.error ?? payload.raw ?? fallback;
}

export function RepoRadarShell({
  repos,
  username,
  collectorStatus,
  collectorSyncConfig,
}: {
  repos: RadarRepo[];
  username: string | null;
  collectorStatus: CollectorStatus;
  collectorSyncConfig: CollectorSyncConfig;
}) {
  const [locale, setLocale] = useState<Locale>("en");
  const router = useRouter();
  const [isSyncPending, setIsSyncPending] = useState(false);
  const [isUnlockPending, setIsUnlockPending] = useState(false);
  const [collectorTriggerToken, setCollectorTriggerToken] = useState("");
  const [hasTriggerSession, setHasTriggerSession] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    tone: "success" | "warning";
    message: string;
  } | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const storedTheme = window.localStorage.getItem("repo-radar-theme");

    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const copy = COPY[locale];
  const collectorEnabled = repos.some((repo) => repo.collectorBacked);
  const viewerMatchesCollector =
    Boolean(username) &&
    Boolean(collectorStatus.configuredOwner) &&
    username?.toLowerCase() === collectorStatus.configuredOwner?.toLowerCase();
  const collectorWaiting =
    viewerMatchesCollector &&
    collectorStatus.configured &&
    collectorStatus.reachable &&
    collectorStatus.dbReady &&
    collectorStatus.lastCollectionAt == null;
  const collectorLabel = collectorEnabled
    ? copy.collectorHistoryOn
    : !collectorStatus.configured
      ? copy.collectorSetupNeeded
      : !collectorStatus.reachable
        ? copy.collectorUnavailable
        : !collectorStatus.dbReady
          ? copy.collectorDegraded
          : collectorWaiting
          ? copy.collectorWaiting
          : copy.collectorDirect;
  const collectorTone = collectorEnabled
    ? "success"
    : !collectorStatus.configured || !collectorStatus.reachable || !collectorStatus.dbReady
      ? "warning"
      : "default";
  const canTriggerCollector = viewerMatchesCollector && collectorStatus.configured;
  const manualSyncReady = canTriggerCollector && collectorSyncConfig.manualSyncReady;
  const canSyncCollector = manualSyncReady && hasTriggerSession;
  const missingSyncMessages = [
    !collectorSyncConfig.workerUrlConfigured ? copy.syncMissingWorkerUrl : null,
    !collectorSyncConfig.apiSecretConfigured ? copy.syncMissingApiSecret : null,
    !collectorSyncConfig.triggerTokenConfigured ? copy.syncMissingTriggerToken : null,
  ].filter((message) => message !== null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("repo-radar-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!manualSyncReady) {
      setHasTriggerSession(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/collector/trigger/session", {
          method: "GET",
          cache: "no-store",
        });
        const payload = await readResponsePayload(response);

        if (!cancelled) {
          setHasTriggerSession(Boolean(payload?.authenticated && response.ok));
        }
      } catch {
        if (!cancelled) {
          setHasTriggerSession(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [manualSyncReady]);

  async function handleUnlockCollector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSyncFeedback(null);

    if (!collectorTriggerToken.trim()) {
      setSyncFeedback({
        tone: "warning",
        message: `${copy.syncError} ${copy.syncTokenRequired}`,
      });
      return;
    }

    setIsUnlockPending(true);

    try {
      const response = await fetch("/api/collector/trigger/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: collectorTriggerToken }),
      });
      const payload = await readResponsePayload(response);

      if (!response.ok) {
        setSyncFeedback({
          tone: "warning",
          message: `${copy.syncError} ${readTriggerErrorMessage(payload, copy.syncError)}`,
        });
        return;
      }

      setCollectorTriggerToken("");
      setHasTriggerSession(true);
      setSyncFeedback({
        tone: "success",
        message: copy.syncUnlockSuccess,
      });
    } catch (error) {
      setSyncFeedback({
        tone: "warning",
        message: `${copy.syncError} ${error instanceof Error ? error.message : ""}`.trim(),
      });
    } finally {
      setIsUnlockPending(false);
    }
  }

  async function handleCollectorSync() {
    if (isSyncPending || !canSyncCollector) {
      return;
    }

    setSyncFeedback(null);
    setIsSyncPending(true);

    try {
      const response = await fetch("/api/collector/trigger", {
        method: "POST",
      });
      const payload = await readResponsePayload(response);

      if (!response.ok) {
        if (response.status === 401) {
          setHasTriggerSession(false);
          setSyncFeedback({
            tone: "warning",
            message: copy.syncSessionExpired,
          });
          return;
        }

        setSyncFeedback({
          tone: "warning",
          message: `${copy.syncError} ${readTriggerErrorMessage(payload, copy.syncError)}`,
        });
        return;
      }

      setSyncFeedback({
        tone: "success",
        message: copy.syncSuccess,
      });
      router.refresh();
    } catch (error) {
      setSyncFeedback({
        tone: "warning",
        message: `${copy.syncError} ${error instanceof Error ? error.message : ""}`.trim(),
      });
    } finally {
      setIsSyncPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 text-foreground dark:from-[#090b13] dark:via-[#0d1220] dark:to-[#171b2d]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.05),_transparent_45%),radial-gradient(ellipse_at_bottom_left,_rgba(168,85,247,0.05),_transparent_40%)] dark:bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.16),_transparent_42%),radial-gradient(ellipse_at_bottom_left,_rgba(168,85,247,0.14),_transparent_38%)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="mb-16">
          <div className="mb-6 flex items-start justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 opacity-30 blur-xl" />
                <div className="relative rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 p-3">
                  <TrendingUp className="h-8 w-8 text-white" />
                </div>
              </div>
              <h1 className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-5xl font-bold text-transparent dark:from-blue-400 dark:to-purple-400">
                {copy.title}
              </h1>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-1.5 backdrop-blur-sm dark:border-white/10 dark:bg-white/6">
              <span className="px-2 text-sm text-muted-foreground">{copy.language}</span>
              <div className="flex gap-1">
                {(["en", "ja"] as const).map((value) => {
                  const active = value === locale;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setLocale(value)}
                      className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-sm"
                          : "text-foreground hover:bg-accent"
                      }`}
                    >
                      {value.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mb-6 flex items-center justify-end">
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/50 p-1.5 backdrop-blur-sm dark:border-white/10 dark:bg-white/6">
              <span className="px-2 text-sm text-muted-foreground">{copy.theme}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                    theme === "light"
                      ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-sm"
                      : "text-foreground hover:bg-accent"
                  }`}
                  aria-label="Light mode"
                >
                  <span className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    <span>Light</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                    theme === "dark"
                      ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-sm"
                      : "text-foreground hover:bg-accent"
                  }`}
                  aria-label="Dark mode"
                >
                  <span className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    <span>Dark</span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          <p className="mb-3 text-2xl font-medium">{copy.hero}</p>
          <p className="mb-8 max-w-3xl text-lg text-muted-foreground">{copy.description}</p>

          <div className="mb-8 flex flex-wrap items-center gap-2">
            <InfoPill tone={collectorTone}>
              {collectorLabel}
            </InfoPill>
            {collectorStatus.configured && collectorStatus.configuredOwner ? (
              <InfoPill>
                {copy.collectorOwner} {collectorStatus.configuredOwner}
              </InfoPill>
            ) : null}
            {collectorStatus.lastCollectionAt ? (
              <InfoPill>
                {copy.lastSync} {formatCollectorTimestamp(collectorStatus.lastCollectionAt, locale)}
              </InfoPill>
            ) : null}
            {collectorStatus.repoCount != null ? (
              <InfoPill>
                {copy.syncedRepos} {collectorStatus.repoCount}
              </InfoPill>
            ) : null}
            {collectorStatus.latestSnapshotDate ? (
              <InfoPill>
                {copy.latestData} {collectorStatus.latestSnapshotDate}
              </InfoPill>
            ) : null}
            {collectorStatus.reposWithHistory != null ? (
              <InfoPill>
                {copy.reposWithHistory} {collectorStatus.reposWithHistory}
              </InfoPill>
            ) : null}
            {canSyncCollector ? (
              <button
                type="button"
                onClick={handleCollectorSync}
                disabled={isSyncPending}
                className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-blue-300"
              >
                {isSyncPending ? copy.syncingCollector : copy.syncCollector}
              </button>
            ) : null}
          </div>
          {canTriggerCollector || syncFeedback ? (
            <div className="mb-8 flex flex-wrap items-center gap-2">
              {manualSyncReady ? (
                <InfoPill>{copy.syncReady}</InfoPill>
              ) : null}
              {canTriggerCollector && !manualSyncReady
                ? missingSyncMessages.map((message) => (
                    <InfoPill key={message} tone="warning">
                      {message}
                    </InfoPill>
                  ))
                : null}
              {manualSyncReady && !hasTriggerSession ? (
                <>
                  <InfoPill>{copy.syncUnlockHelp}</InfoPill>
                  <form onSubmit={handleUnlockCollector} className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <span>{copy.syncTokenLabel}</span>
                      <input
                        type="password"
                        value={collectorTriggerToken}
                        onChange={(event) => setCollectorTriggerToken(event.target.value)}
                        placeholder={copy.syncTokenPlaceholder}
                        className="h-9 rounded-full border border-border/60 bg-card/60 px-4 text-sm text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20 dark:border-white/10 dark:bg-white/6"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isUnlockPending}
                      className="inline-flex h-9 items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-4 text-xs font-medium text-blue-700 transition hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:text-blue-300"
                    >
                      {isUnlockPending ? copy.unlockingCollector : copy.unlockCollector}
                    </button>
                  </form>
                </>
              ) : null}
              {syncFeedback ? (
                <InfoPill tone={syncFeedback.tone}>{syncFeedback.message}</InfoPill>
              ) : null}
            </div>
          ) : null}

          <form action="/" method="get" className="flex max-w-lg items-end gap-3">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium">{copy.tracking}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  name="username"
                  defaultValue={username ?? ""}
                  placeholder={copy.usernamePlaceholder}
                  className="h-12 w-full rounded-md border border-border/50 bg-card/50 pl-10 pr-3 text-sm backdrop-blur-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20 dark:border-white/10 dark:bg-white/6"
                />
              </div>
            </div>
            <button
              type="submit"
              className="h-12 rounded-md bg-gradient-to-r from-blue-500 to-purple-500 px-8 text-sm font-medium text-white shadow-sm transition hover:from-blue-600 hover:to-purple-600 dark:shadow-[0_14px_36px_rgba(76,99,255,0.28)]"
            >
              {copy.load}
            </button>
          </form>
        </section>

        {repos.length > 0 ? (
          <RepoRadar repos={repos} locale={locale} />
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-20 blur-2xl" />
              <div className="relative rounded-full border border-border/50 bg-card p-8 backdrop-blur-sm">
                <TrendingUp className="h-16 w-16 text-muted-foreground" />
              </div>
            </div>
            <h2 className="mb-3 text-2xl font-bold">{copy.emptyTitle}</h2>
            <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
              {copy.emptyDescription}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function InfoPill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  const className = {
    default: "border-border/60 bg-card/60 text-muted-foreground dark:border-white/10 dark:bg-white/6",
    success: "border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-400",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  }[tone];

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}
