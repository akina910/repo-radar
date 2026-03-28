import { RepoRadarShell } from "@/components/repo-radar-shell";
import { getRadarRepos } from "@/lib/github";

export default async function Home() {
  const repos = await getRadarRepos();
  const username =
    !process.env.GITHUB_USERNAME || process.env.GITHUB_USERNAME === "your-github-username"
      ? "akina910"
      : process.env.GITHUB_USERNAME;

  return <RepoRadarShell repos={repos} username={username ?? null} />;
}
