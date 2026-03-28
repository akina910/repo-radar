"use client";

import { useMemo, useState } from "react";

export type RadarRepo = {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  updatedAt: string;
  pushedAt: string;
  viewsCount: number | null;
  clonesCount: number | null;
  trafficAvailable: boolean;
};

type SortKey = "views" | "stars" | "updated" | "clones";

type Locale = "en" | "ja";

type CopySet = {
  summary: {
    publicRepos: string;
    trafficReady: string;
    totalStars: string;
    mostViewed: string;
    viewsAndClones: string;
    noTraffic: string;
  };
  sortBy: string;
  trafficHint: string;
  sortOptions: Record<SortKey, string>;
  open: string;
  noDescription: string;
  metrics: {
    views: string;
    clones: string;
    stars: string;
    forks: string;
  };
  chips: {
    updated: string;
    openIssues: string;
    hasHomepage: string;
    trafficUnavailable: string;
  };
  signals: {
    active: string;
    cold: string;
    fresh: string;
  };
  today: string;
};

const COPY: Record<Locale, CopySet> = {
  en: {
    summary: {
      publicRepos: "Public repos",
      trafficReady: "Traffic ready",
      totalStars: "Total stars",
      mostViewed: "Most viewed",
      viewsAndClones: "views / clones",
      noTraffic: "No traffic",
    },
    sortBy: "Sort by",
    trafficHint:
      "This MVP reads your public repositories and surfaces the repos that are getting attention. Traffic numbers depend on a GitHub token with access to traffic metrics.",
    sortOptions: {
      views: "Views",
      stars: "Stars",
      updated: "Updated",
      clones: "Clones",
    },
    open: "Open",
    noDescription: "No description yet.",
    metrics: {
      views: "Views",
      clones: "Clones",
      stars: "Stars",
      forks: "Forks",
    },
    chips: {
      updated: "Updated",
      openIssues: "open issues",
      hasHomepage: "Has homepage",
      trafficUnavailable: "Traffic unavailable",
    },
    signals: {
      active: "Active",
      cold: "Cold",
      fresh: "Fresh",
    },
    today: "today",
  },
  ja: {
    summary: {
      publicRepos: "公開repo数",
      trafficReady: "Traffic取得済み",
      totalStars: "合計Stars",
      mostViewed: "最多Views",
      viewsAndClones: "views / clones",
      noTraffic: "trafficなし",
    },
    sortBy: "並び替え",
    trafficHint:
      "この MVP は public repo を読み込み、反応が出ている repo を見つけやすくします。views / clones は traffic API を読める GitHub token がある時だけ出ます。",
    sortOptions: {
      views: "Views順",
      stars: "Stars順",
      updated: "更新順",
      clones: "Clones順",
    },
    open: "開く",
    noDescription: "説明はまだありません。",
    metrics: {
      views: "Views",
      clones: "Clones",
      stars: "Stars",
      forks: "Forks",
    },
    chips: {
      updated: "更新",
      openIssues: "件のopen issue",
      hasHomepage: "homepageあり",
      trafficUnavailable: "traffic未取得",
    },
    signals: {
      active: "反応あり",
      cold: "放置気味",
      fresh: "新しめ",
    },
    today: "今日",
  },
};

function formatRelativeDate(value: string, locale: Locale) {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diffMs = new Date(value).getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffDays) < 1) return COPY[locale].today;
  if (Math.abs(diffDays) < 30) return formatter.format(diffDays, "day");

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) return formatter.format(diffMonths, "month");

  const diffYears = Math.round(diffMonths / 12);
  return formatter.format(diffYears, "year");
}

function getSignal(repo: RadarRepo, locale: Locale) {
  if ((repo.viewsCount ?? 0) >= 20 || repo.stargazersCount >= 3) {
    return { label: COPY[locale].signals.active, tone: "emerald" };
  }

  const updatedDays = Math.abs(
    Math.round((Date.now() - new Date(repo.pushedAt).getTime()) / (1000 * 60 * 60 * 24)),
  );

  if (updatedDays > 30) {
    return { label: COPY[locale].signals.cold, tone: "amber" };
  }

  return { label: COPY[locale].signals.fresh, tone: "sky" };
}

function toneClass(tone: string) {
  switch (tone) {
    case "emerald":
      return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
    case "amber":
      return "border-amber-400/40 bg-amber-400/10 text-amber-100";
    default:
      return "border-sky-400/40 bg-sky-400/10 text-sky-100";
  }
}

export function RepoRadar({
  repos,
  locale,
}: {
  repos: RadarRepo[];
  locale: Locale;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const copy = COPY[locale];

  const sortedRepos = useMemo(() => {
    const cloned = [...repos];

    cloned.sort((left, right) => {
      switch (sortKey) {
        case "stars":
          return right.stargazersCount - left.stargazersCount;
        case "updated":
          return new Date(right.pushedAt).getTime() - new Date(left.pushedAt).getTime();
        case "clones":
          return (right.clonesCount ?? -1) - (left.clonesCount ?? -1);
        case "views":
        default:
          return (right.viewsCount ?? -1) - (left.viewsCount ?? -1);
      }
    });

    return cloned;
  }, [repos, sortKey]);

  const reposWithTraffic = repos.filter((repo) => repo.trafficAvailable).length;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard label={copy.summary.publicRepos} value={String(repos.length)} />
        <SummaryCard
          label={copy.summary.trafficReady}
          value={`${reposWithTraffic}/${repos.length}`}
          helper={copy.summary.viewsAndClones}
        />
        <SummaryCard
          label={copy.summary.totalStars}
          value={String(repos.reduce((sum, repo) => sum + repo.stargazersCount, 0))}
        />
        <SummaryCard
          label={copy.summary.mostViewed}
          value={
            sortedRepos[0]?.viewsCount != null
              ? `${sortedRepos[0].viewsCount}`
              : copy.summary.noTraffic
          }
          helper={sortedRepos[0]?.name ?? "—"}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-zinc-400">{copy.sortBy}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["views", "stars", "updated", "clones"] as SortKey[]).map((key) => {
              const option = { key, label: copy.sortOptions[key] };
              const active = option.key === sortKey;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSortKey(option.key)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    active
                      ? "border-white/30 bg-white text-black"
                      : "border-white/10 bg-black/20 text-zinc-300 hover:border-white/20"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="max-w-xl text-sm leading-6 text-zinc-400">{copy.trafficHint}</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {sortedRepos.map((repo) => {
          const signal = getSignal(repo, locale);

          return (
            <article
              key={repo.id}
              className="rounded-3xl border border-white/10 bg-zinc-950/70 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-white">{repo.name}</h2>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs ${toneClass(signal.tone)}`}
                    >
                      {signal.label}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400">{repo.description ?? copy.noDescription}</p>
                </div>
                <a
                  href={repo.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-white/30"
                >
                  {copy.open}
                </a>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Metric label={copy.metrics.views} value={repo.viewsCount} fallback="—" />
                <Metric label={copy.metrics.clones} value={repo.clonesCount} fallback="—" />
                <Metric label={copy.metrics.stars} value={repo.stargazersCount} />
                <Metric label={copy.metrics.forks} value={repo.forksCount} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2 text-xs text-zinc-400">
                <Chip label={`${copy.chips.updated} ${formatRelativeDate(repo.pushedAt, locale)}`} />
                <Chip label={`${repo.openIssuesCount} ${copy.chips.openIssues}`} />
                {repo.language ? <Chip label={repo.language} /> : null}
                {repo.homepage ? <Chip label={copy.chips.hasHomepage} /> : null}
                {!repo.trafficAvailable ? <Chip label={copy.chips.trafficUnavailable} /> : null}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      {helper ? <p className="mt-1 text-xs text-zinc-500">{helper}</p> : null}
    </div>
  );
}

function Metric({
  label,
  value,
  fallback,
}: {
  label: string;
  value: number | null;
  fallback?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-medium text-white">
        {value == null ? fallback ?? "0" : new Intl.NumberFormat("en").format(value)}
      </p>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return <span className="rounded-full border border-white/10 px-2.5 py-1">{label}</span>;
}
