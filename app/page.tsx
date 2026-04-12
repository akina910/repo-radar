import { RepoRadarShell } from "@/components/repo-radar-shell";
import { getCollectorStatus, getRadarRepos } from "@/lib/github";

type HomeProps = {
  searchParams: Promise<{
    username?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const requestedUsername = resolvedSearchParams.username?.trim();
  const envUsername =
    !process.env.GITHUB_USERNAME || process.env.GITHUB_USERNAME === "your-github-username"
      ? undefined
      : process.env.GITHUB_USERNAME;
  const username = requestedUsername || envUsername;
  const [repos, collectorStatus] = await Promise.all([
    getRadarRepos(username),
    getCollectorStatus(),
  ]);

  return (
    <RepoRadarShell
      repos={repos}
      username={username ?? null}
      collectorStatus={collectorStatus}
    />
  );
}
