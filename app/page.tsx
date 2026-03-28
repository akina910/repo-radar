import { RepoRadarShell } from "@/components/repo-radar-shell";
import { getRadarRepos } from "@/lib/github";

type HomeProps = {
  searchParams: Promise<{
    username?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const requestedUsername = resolvedSearchParams.username?.trim();
  const username =
    requestedUsername ||
    (!process.env.GITHUB_USERNAME || process.env.GITHUB_USERNAME === "your-github-username"
      ? "akina910"
      : process.env.GITHUB_USERNAME);
  const repos = await getRadarRepos(username);

  return <RepoRadarShell repos={repos} username={username ?? null} />;
}
