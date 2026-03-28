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

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "views", label: "Views" },
  { key: "stars", label: "Stars" },
  { key: "updated", label: "Updated" },
  { key: "clones", label: "Clones" },
];

function formatRelativeDate(value: string) {
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffMs = new Date(value).getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffDays) < 1) return "today";
  if (Math.abs(diffDays) < 30) return formatter.format(diffDays, "day");

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) return formatter.format(diffMonths, "month");

  const diffYears = Math.round(diffMonths / 12);
  return formatter.format(diffYears, "year");
}

function getSignal(repo: RadarRepo) {
  if ((repo.viewsCount ?? 0) >= 20 || repo.stargazersCount >= 3) {
    return { label: "Active", tone: "emerald" };
  }

  const updatedDays = Math.abs(
    Math.round((Date.now() - new Date(repo.pushedAt).getTime()) / (1000 * 60 * 60 * 24)),
  );

  if (updatedDays > 30) {
    return { label: "Cold", tone: "amber" };
  }

  return { label: "Fresh", tone: "sky" };
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

export function RepoRadar({ repos }: { repos: RadarRepo[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("views");

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
        <SummaryCard label="Public repos" value={String(repos.length)} />
        <SummaryCard
          label="Traffic ready"
          value={`${reposWithTraffic}/${repos.length}`}
          helper="views / clones"
        />
        <SummaryCard
          label="Total stars"
          value={String(repos.reduce((sum, repo) => sum + repo.stargazersCount, 0))}
        />
        <SummaryCard
          label="Most viewed"
          value={
            sortedRepos[0]?.viewsCount != null
              ? `${sortedRepos[0].viewsCount}`
              : "No traffic"
          }
          helper={sortedRepos[0]?.name ?? "—"}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-zinc-400">Sort by</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SORT_OPTIONS.map((option) => {
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
        <p className="max-w-xl text-sm leading-6 text-zinc-400">
          This MVP reads your public repositories and surfaces the repos that are getting
          attention. Traffic numbers depend on a GitHub token with access to traffic metrics.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {sortedRepos.map((repo) => {
          const signal = getSignal(repo);

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
                  <p className="text-sm text-zinc-400">{repo.description ?? "No description yet."}</p>
                </div>
                <a
                  href={repo.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-white/30"
                >
                  Open
                </a>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Metric label="Views" value={repo.viewsCount} fallback="—" />
                <Metric label="Clones" value={repo.clonesCount} fallback="—" />
                <Metric label="Stars" value={repo.stargazersCount} />
                <Metric label="Forks" value={repo.forksCount} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2 text-xs text-zinc-400">
                <Chip label={`Updated ${formatRelativeDate(repo.pushedAt)}`} />
                <Chip label={`${repo.openIssuesCount} open issues`} />
                {repo.language ? <Chip label={repo.language} /> : null}
                {repo.homepage ? <Chip label="Has homepage" /> : null}
                {!repo.trafficAvailable ? <Chip label="Traffic unavailable" /> : null}
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
