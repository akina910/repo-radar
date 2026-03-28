"use client";

import { useState } from "react";

import { RepoRadar, type RadarRepo } from "@/components/repo-radar";

type Locale = "en" | "ja";

const COPY = {
  en: {
    eyebrow: "Repo Radar",
    productName: "Repo Radar",
    title: "See which repositories are quietly getting traction.",
    description:
      "A lightweight dashboard for GitHub repositories. It focuses on repo-level attention, not generic analytics noise.",
    language: "Language",
    tracking: "Tracking",
    noUsername: "No username set",
    envHint:
      "Set GITHUB_USERNAME to load repositories. Add GITHUB_TOKEN if you want views and clones from GitHub traffic endpoints.",
    emptyTitle: "No repositories loaded yet.",
    emptyDescription:
      "Add your GitHub username in the environment file and restart the app. This first version keeps the scope intentionally small.",
  },
  ja: {
    eyebrow: "Repo Radar",
    productName: "Repo Radar",
    title: "どのリポジトリに静かに反応が集まっているかを一目で見る。",
    description:
      "GitHub リポジトリを見るための軽量ダッシュボードです。一般的な analytics ではなく、リポジトリごとの反応に絞ります。",
    language: "言語",
    tracking: "GitHubユーザー",
    noUsername: "未設定",
    envHint:
      "リポジトリを読むには GITHUB_USERNAME を入れます。views / clones を出すなら GITHUB_TOKEN も入れます。",
    emptyTitle: "まだリポジトリが読み込まれていません。",
    emptyDescription:
      "環境変数に GitHub ユーザー名を入れて、アプリを再起動してください。最初の版は意図的に小さくしています。",
  },
} as const;

export function RepoRadarShell({
  repos,
  username,
}: {
  repos: RadarRepo[];
  username: string | null;
}) {
  const [locale, setLocale] = useState<Locale>("en");
  const copy = COPY[locale];

  return (
    <main className="min-h-screen bg-[#060816] px-6 py-10 text-zinc-100 md:px-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.08),_transparent_40%),radial-gradient(ellipse_at_bottom_left,_rgba(168,85,247,0.08),_transparent_36%)]" />
      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(74,222,128,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.18),_transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-8 shadow-2xl shadow-black/20">
          <div className="absolute inset-y-0 right-0 w-72 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.18),_transparent_62%)] opacity-70 blur-2xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 opacity-30 blur-xl" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 text-xl font-semibold text-white">
                  RR
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">{copy.eyebrow}</p>
                <p className="bg-gradient-to-r from-blue-300 via-white to-violet-300 bg-clip-text text-3xl font-semibold tracking-tight text-transparent md:text-5xl">
                  {copy.productName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 self-start rounded-full border border-white/10 bg-black/20 px-3 py-2 backdrop-blur-sm">
              <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">{copy.language}</span>
              <div className="flex gap-2">
                {(["en", "ja"] as const).map((value) => {
                  const active = value === locale;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setLocale(value)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        active
                          ? "border-white/40 bg-white text-black"
                          : "border-white/10 bg-black/20 text-zinc-300 hover:border-white/20"
                      }`}
                    >
                      {value.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="relative mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <h1 className="max-w-4xl text-3xl font-medium tracking-tight text-white md:text-5xl">
                {copy.title}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-zinc-300 md:text-lg">
                {copy.description}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/25 px-5 py-4 text-sm text-zinc-300 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-sm">
              <p className="text-zinc-500">{copy.tracking}</p>
              <p className="mt-1 text-lg font-medium text-white">
                {username && username !== "your-github-username" ? username : copy.noUsername}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-400 backdrop-blur-sm">
          <p>{copy.envHint}</p>
        </section>

        <div className="mt-8">
          {repos.length > 0 ? (
            <RepoRadar repos={repos} locale={locale} />
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-zinc-300">
              <h2 className="text-xl font-semibold text-white">{copy.emptyTitle}</h2>
              <p className="mt-3 max-w-2xl leading-7 text-zinc-400">{copy.emptyDescription}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
