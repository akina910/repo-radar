"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  Eye,
  GitBranch,
  GitFork,
  Star,
} from "lucide-react";

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
  publicRepos: string;
  trafficReady: string;
  totalStars: string;
  mostViewed: string;
  sortBy: string;
  views: string;
  clones: string;
  stars: string;
  updated: string;
  forks: string;
  updatedLabel: string;
  openIssues: string;
  hasHomepage: string;
  trafficUnavailable: string;
  open: string;
  mvpNote: string;
  noDescription: string;
  noTraffic: string;
  signals: {
    active: string;
    cold: string;
    fresh: string;
  };
};

const COPY: Record<Locale, CopySet> = {
  en: {
    publicRepos: "Public repositories",
    trafficReady: "Traffic ready",
    totalStars: "Total stars",
    mostViewed: "Most viewed",
    sortBy: "Sort by",
    views: "Views",
    clones: "Clones",
    stars: "Stars",
    updated: "Updated",
    forks: "Forks",
    updatedLabel: "Updated",
    openIssues: "open issues",
    hasHomepage: "Has homepage",
    trafficUnavailable: "Traffic unavailable",
    open: "Open",
    mvpNote:
      "This MVP reads your public repositories and surfaces the repos that are getting attention. Traffic numbers depend on a GitHub token with access to traffic metrics.",
    noDescription: "No description available",
    noTraffic: "—",
    signals: {
      active: "Active",
      cold: "Cold",
      fresh: "Fresh",
    },
  },
  ja: {
    publicRepos: "公開リポジトリ数",
    trafficReady: "Traffic取得済み",
    totalStars: "合計Stars",
    mostViewed: "最多Views",
    sortBy: "並び替え",
    views: "Views",
    clones: "Clones",
    stars: "Stars",
    updated: "更新順",
    forks: "Forks",
    updatedLabel: "更新",
    openIssues: "未解決の問題",
    hasHomepage: "ホームページあり",
    trafficUnavailable: "Traffic取得不可",
    open: "開く",
    mvpNote:
      "この MVP は公開リポジトリを読み込み、注目を集めているリポジトリを表示します。Traffic 数値は GitHub トークンとアクセス権限に依存します。",
    noDescription: "説明はまだありません。",
    noTraffic: "—",
    signals: {
      active: "反応あり",
      cold: "放置気味",
      fresh: "新しめ",
    },
  },
};

function formatRelativeDate(dateString: string, locale: Locale): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (locale === "ja") {
    if (diffDays === 0) return "今日";
    if (diffDays === 1) return "昨日";
    if (diffDays < 7) return `${diffDays}日前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}ヶ月前`;
    return `${Math.floor(diffDays / 365)}年前`;
  }

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function getSignal(repo: RadarRepo, locale: Locale) {
  const copy = COPY[locale];

  if ((repo.viewsCount ?? 0) >= 20 || repo.stargazersCount >= 3) {
    return {
      label: copy.signals.active,
      className: "border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-400",
    };
  }

  const updatedDays = Math.abs(
    Math.round((Date.now() - new Date(repo.pushedAt).getTime()) / (1000 * 60 * 60 * 24)),
  );

  if (updatedDays > 30) {
    return {
      label: copy.signals.cold,
      className: "border-gray-500/20 bg-gray-500/10 text-gray-700 dark:text-gray-400",
    };
  }

  return {
    label: copy.signals.fresh,
    className: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  };
}

export function RepoRadar({
  repos,
  locale,
}: {
  repos: RadarRepo[];
  locale: Locale;
}) {
  const copy = COPY[locale];
  const [sortBy, setSortBy] = useState<SortKey>("views");

  const sortedRepos = useMemo(() => {
    return [...repos].sort((left, right) => {
      switch (sortBy) {
        case "stars":
          return right.stargazersCount - left.stargazersCount;
        case "clones":
          return (right.clonesCount ?? 0) - (left.clonesCount ?? 0);
        case "updated":
          return new Date(right.pushedAt).getTime() - new Date(left.pushedAt).getTime();
        case "views":
        default:
          return (right.viewsCount ?? 0) - (left.viewsCount ?? 0);
      }
    });
  }, [repos, sortBy]);

  const totalStars = repos.reduce((sum, repo) => sum + repo.stargazersCount, 0);
  const trafficReadyCount = repos.filter((repo) => repo.trafficAvailable).length;
  const mostViewedRepo = repos.reduce<RadarRepo | null>((max, repo) => {
    if (!max) return repo;
    return (repo.viewsCount ?? 0) > (max.viewsCount ?? 0) ? repo : max;
  }, repos[0] ?? null);

  return (
    <>
      <section className="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label={copy.publicRepos} value={repos.length} index={0} />
        <SummaryCard label={copy.trafficReady} value={`${trafficReadyCount}/${repos.length}`} index={1} />
        <SummaryCard label={copy.totalStars} value={totalStars} index={2} />
        <SummaryCard
          label={copy.mostViewed}
          value={mostViewedRepo?.viewsCount ?? copy.noTraffic}
          subtitle={mostViewedRepo?.name}
          index={3}
        />
      </section>

      <section className="mb-8 rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm dark:border-white/10 dark:bg-white/6">
        <div className="mb-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="font-semibold">{copy.sortBy}</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortKey)}
                className="h-10 min-w-[180px] appearance-none rounded-md border border-border bg-background/50 px-3 pr-9 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20 dark:border-white/10 dark:bg-white/6"
              >
                <option value="views">{copy.views}</option>
                <option value="stars">{copy.stars}</option>
                <option value="updated">{copy.updated}</option>
                <option value="clones">{copy.clones}</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <ChevronDown />
              </span>
            </div>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.mvpNote}</p>
      </section>

      <section className="grid grid-cols-1 gap-6">
        {sortedRepos.map((repo) => (
          <RepoCard key={repo.id} repo={repo} copy={copy} locale={locale} />
        ))}
      </section>
    </>
  );
}

function SummaryCard({
  label,
  value,
  subtitle,
  index = 0,
}: {
  label: string;
  value: string | number;
  subtitle?: string | null;
  index?: number;
}) {
  const gradients = [
    "from-blue-500/10 to-blue-600/5",
    "from-purple-500/10 to-purple-600/5",
    "from-green-500/10 to-green-600/5",
    "from-orange-500/10 to-orange-600/5",
  ];

  const iconColors = [
    "from-blue-500 to-blue-600",
    "from-purple-500 to-purple-600",
    "from-green-500 to-green-600",
    "from-orange-500 to-orange-600",
  ];

  return (
    <div className="transition duration-200 hover:-translate-y-1">
      <div
        className={`relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br ${gradients[index % 4]} p-6 backdrop-blur-sm dark:border-white/10 dark:from-white/8 dark:to-white/[0.03]`}
      >
        <div
          className={`absolute right-0 top-0 h-32 w-32 translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br ${iconColors[index % 4]} opacity-5 transition duration-500 hover:scale-150`}
        />
        <div className="relative">
          <div className="mb-3 text-sm font-medium text-muted-foreground">{label}</div>
          <div
            className={`mb-2 bg-gradient-to-r ${iconColors[index % 4]} bg-clip-text text-4xl font-bold text-transparent`}
          >
            {value}
          </div>
          {subtitle ? <div className="truncate text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>
      </div>
    </div>
  );
}

function RepoCard({
  repo,
  copy,
  locale,
}: {
  repo: RadarRepo;
  copy: CopySet;
  locale: Locale;
}) {
  const signal = getSignal(repo, locale);
  const relativeDate = formatRelativeDate(repo.updatedAt, locale);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-7 backdrop-blur-sm transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 dark:border-white/10 dark:bg-white/6 dark:hover:shadow-[0_28px_90px_rgba(0,0,0,0.45)]">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-blue-500/12 dark:to-purple-500/12" />

      <div className="relative">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-3 flex items-center gap-3">
              <h3 className="text-xl font-bold transition-colors group-hover:text-primary">{repo.name}</h3>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${signal.className}`}>
                {signal.label}
              </span>
            </div>
            <p className="mb-5 leading-relaxed text-muted-foreground">
              {repo.description || copy.noDescription}
            </p>
          </div>
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-3 rounded-md p-2 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent dark:hover:bg-white/10"
            aria-label={copy.open}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-6 rounded-lg bg-muted/30 p-4 dark:bg-white/6 sm:grid-cols-4">
          <MetricBlock icon={<Eye className="h-5 w-5" />} tone="blue" label={copy.views} value={repo.trafficAvailable ? repo.viewsCount : null} />
          <MetricBlock icon={<GitBranch className="h-5 w-5" />} tone="purple" label={copy.clones} value={repo.trafficAvailable ? repo.clonesCount : null} />
          <MetricBlock icon={<Star className="h-5 w-5" />} tone="yellow" label={copy.stars} value={repo.stargazersCount} />
          <MetricBlock icon={<GitFork className="h-5 w-5" />} tone="green" label={copy.forks} value={repo.forksCount} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge>{copy.updatedLabel} {relativeDate}</Badge>
          {repo.openIssuesCount > 0 ? (
            <Badge>
              <AlertCircle className="h-3 w-3" />
              {repo.openIssuesCount} {copy.openIssues}
            </Badge>
          ) : null}
          {repo.language ? <Badge>{repo.language}</Badge> : null}
          {repo.homepage ? <Badge>{copy.hasHomepage}</Badge> : null}
          {!repo.trafficAvailable ? <Badge tone="warning">{copy.trafficUnavailable}</Badge> : null}
        </div>
      </div>
    </article>
  );
}

function MetricBlock({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: "blue" | "purple" | "yellow" | "green";
  label: string;
  value: number | null;
}) {
  const toneClass = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    yellow: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
  }[tone];

  return (
    <div className="flex items-center gap-3 transition duration-200 hover:scale-105">
      <div className={`rounded-lg p-2 ${toneClass}`}>{icon}</div>
      <div>
        <div className="mb-0.5 text-xs font-medium text-muted-foreground">{label}</div>
        <div className="text-lg font-bold">
          {value == null ? "—" : value.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "warning";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
        tone === "warning"
          ? "border border-amber-500/30 text-amber-600 dark:text-amber-400"
          : "bg-secondary text-secondary-foreground"
      }`}
    >
      {children}
    </span>
  );
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[2]">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
