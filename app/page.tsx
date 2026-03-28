import { RepoRadar } from "@/components/repo-radar";
import { getRadarRepos } from "@/lib/github";

export default async function Home() {
  const repos = await getRadarRepos();
  const username = process.env.GITHUB_USERNAME;

  return (
    <main className="min-h-screen bg-[#060816] px-6 py-10 text-zinc-100 md:px-10">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(74,222,128,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.18),_transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-8 shadow-2xl shadow-black/20">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">Repo Radar</p>
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
                See which public repos are quietly getting traction.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-zinc-300 md:text-lg">
                A lightweight GitHub dashboard for public repositories. It focuses on repo-level
                attention, not generic analytics noise.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 px-5 py-4 text-sm text-zinc-300">
              <p className="text-zinc-500">Tracking</p>
              <p className="mt-1 text-lg font-medium text-white">{username ?? "No username set"}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-dashed border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-400">
          <p>
            Set <code className="rounded bg-white/10 px-1.5 py-0.5">GITHUB_USERNAME</code> to
            load public repositories. Add{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5">GITHUB_TOKEN</code> if you want
            views and clones from GitHub traffic endpoints.
          </p>
        </section>

        <div className="mt-8">
          {repos.length > 0 ? (
            <RepoRadar repos={repos} />
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-zinc-300">
              <h2 className="text-xl font-semibold text-white">No repositories loaded yet.</h2>
              <p className="mt-3 max-w-2xl leading-7 text-zinc-400">
                Add your GitHub username in the environment file and restart the app. This first
                version only looks at public repositories and keeps the UI intentionally small.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
