"use client";

import { useEffect, useState } from "react";
import { Moon, Search, Sun, TrendingUp } from "lucide-react";

import { RepoRadar, type RadarRepo } from "@/components/repo-radar";

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

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("repo-radar-theme", theme);
  }, [theme]);

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
