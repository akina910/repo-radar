"use client";

import { useState } from "react";

import { RepoRadar, type RadarRepo } from "@/components/repo-radar";

type Locale = "en" | "ja";

const COPY = {
  en: {
    eyebrow: "Repo Radar",
    title: "See which repositories are quietly getting traction.",
    description:
      "A lightweight dashboard for GitHub repositories. It focuses on repo-level attention, not generic analytics noise.",
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
    title: "どの repo に静かに反応が集まっているかを一目で見る。",
    description:
      "GitHub repo を見るための軽量ダッシュボードです。一般的な analytics ではなく、repo ごとの反応に絞ります。",
    tracking: "追跡中",
    noUsername: "ユーザー名未設定",
    envHint:
      "repo を読むには GITHUB_USERNAME を入れます。views / clones を出すなら GITHUB_TOKEN も入れます。",
    emptyTitle: "まだ repo が読み込まれていません。",
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
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex justify-end gap-2">
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

        <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(74,222,128,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.18),_transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-8 shadow-2xl shadow-black/20">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">{copy.eyebrow}</p>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
                {copy.title}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-zinc-300 md:text-lg">
                {copy.description}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 px-5 py-4 text-sm text-zinc-300">
              <p className="text-zinc-500">{copy.tracking}</p>
              <p className="mt-1 text-lg font-medium text-white">{username ?? copy.noUsername}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-400">
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
