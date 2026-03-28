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
      publicRepos: "公開リポジトリ数",
      trafficReady: "Traffic取得済み",
      totalStars: "合計Stars",
      mostViewed: "最多Views",
      viewsAndClones: "views / clones",
      noTraffic: "trafficなし",
    },
    sortBy: "並び替え",
    trafficHint:
      "この MVP は public リポジトリを読み込み、反応が出ているリポジトリを見つけやすくします。views / clones は traffic API を読める GitHub token がある時だけ出ます。",
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
        <SummaryCard index={0} label={copy.summary.publicRepos} value={String(repos.length)} />
        <SummaryCard
          index={1}
          label={copy.summary.trafficReady}
          value={`${reposWithTraffic}/${repos.length}`}
          helper={copy.summary.viewsAndClones}
        />
        <SummaryCard
          index={2}
          label={copy.summary.totalStars}
          value={String(repos.reduce((sum, repo) => sum + repo.stargazersCount, 0))}
        />
        <SummaryCard
          index={3}
          label={copy.summary.mostViewed}
          value={
            sortedRepos[0]?.viewsCount != null
              ? `${sortedRepos[0].viewsCount}`
              : copy.summary.noTraffic
          }
          helper={sortedRepos[0]?.name ?? "—"}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)] md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-400">{copy.sortBy}</p>
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

      <section className="grid gap-5 lg:grid-cols-2">
        {sortedRepos.map((repo) => {
          const signal = getSignal(repo, locale);

          return (
            <article
              key={repo.id}
              className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/70 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] transition duration-300 hover:-translate-y-1 hover:border-white/20"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.10),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(168,85,247,0.10),_transparent_28%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="flex items-start justify-between gap-4">
                <div className="relative space-y-2">
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
                  className="relative rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-200 opacity-80 transition hover:border-white/30 hover:opacity-100"
                >
                  {copy.open}
                </a>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Metric label={copy.metrics.views} value={repo.viewsCount} fallback="—" accent="blue" />
                <Metric label={copy.metrics.clones} value={repo.clonesCount} fallback="—" accent="violet" />
                <Metric label={copy.metrics.stars} value={repo.stargazersCount} accent="amber" />
                <Metric label={copy.metrics.forks} value={repo.forksCount} accent="emerald" />
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
  index = 0,
  label,
  value,
  helper,
}: {
  index?: number;
  label: string;
  value: string;
  helper?: string;
}) {
  const gradients = [
    "from-blue-500/12 to-blue-600/4",
    "from-violet-500/12 to-violet-600/4",
    "from-emerald-500/12 to-emerald-600/4",
    "from-amber-500/12 to-amber-600/4",
  ];
  const textGradients = [
    "from-blue-300 to-blue-500",
    "from-violet-300 to-violet-500",
    "from-emerald-300 to-emerald-500",
    "from-amber-200 to-amber-500",
  ];

  return (
    <div
      className={`relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br ${gradients[index % 4]} p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)]`}
    >
      <div
        className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${textGradients[index % 4]} opacity-10 blur-2xl`}
      />
      <p className="relative text-sm font-medium text-zinc-400">{label}</p>
      <p
        className={`relative mt-3 bg-gradient-to-r ${textGradients[index % 4]} bg-clip-text text-4xl font-semibold text-transparent`}
      >
        {value}
      </p>
      {helper ? <p className="mt-1 text-xs text-zinc-500">{helper}</p> : null}
    </div>
  );
}

function Metric({
  label,
  value,
  fallback,
  accent = "blue",
}: {
  label: string;
  value: number | null;
  fallback?: string;
  accent?: "blue" | "violet" | "amber" | "emerald";
}) {
  const accents = {
    blue: "bg-blue-500/10 text-blue-300",
    violet: "bg-violet-500/10 text-violet-300",
    amber: "bg-amber-500/10 text-amber-300",
    emerald: "bg-emerald-500/10 text-emerald-300",
  } as const;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold uppercase ${accents[accent]}`}>
          {label.slice(0, 1)}
        </span>
        <p className="text-xl font-medium text-white">
        {value == null ? fallback ?? "0" : new Intl.NumberFormat("en").format(value)}
        </p>
      </div>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return <span className="rounded-full border border-white/10 px-2.5 py-1">{label}</span>;
}
