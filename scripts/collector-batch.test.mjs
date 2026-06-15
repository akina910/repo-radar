import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchCollectorBatchMap,
  isReferrerSummary,
  isTrafficDay,
  parseCollectorRepoIdsParam,
  parseCollectorReposParam,
} from "../lib/collector-batch.ts";

test("parseCollectorReposParam keeps valid unique GitHub repo names only", () => {
  const manyRepos = Array.from({ length: 70 }, (_, index) => `repo-${index}`).join(",");

  assert.deepEqual(parseCollectorReposParam(null), []);
  assert.deepEqual(
    parseCollectorReposParam(
      "repo-radar,repo-radar,%E3%81%82,bad/repo,valid.name,_ok,space%20bad",
    ),
    ["repo-radar", "valid.name", "_ok"],
  );
  assert.equal(parseCollectorReposParam(manyRepos).length, 60);
});

test("parseCollectorRepoIdsParam keeps valid unique safe integer IDs only", () => {
  const manyRepoIds = Array.from({ length: 70 }, (_, index) => String(index + 1)).join(",");

  assert.deepEqual(parseCollectorRepoIdsParam(null), []);
  assert.deepEqual(
    parseCollectorRepoIdsParam("123,123,0,-1,abc,9007199254740992,456"),
    ["123", "456"],
  );
  assert.equal(parseCollectorRepoIdsParam(manyRepoIds).length, 60);
});

test("collector item guards reject partial or malformed rows", () => {
  assert.equal(
    isTrafficDay({
      date: "2026-06-15",
      views_count: 10,
      views_uniques: 4,
      clones_count: 2,
      clones_uniques: 1,
    }),
    true,
  );
  assert.equal(
    isTrafficDay({
      date: "2026-06-15",
      views_count: "10",
      views_uniques: 4,
      clones_count: 2,
      clones_uniques: 1,
    }),
    false,
  );

  assert.equal(
    isReferrerSummary({
      referrer: "github.com",
      total_count: 12,
      last_seen: "2026-06-15",
    }),
    true,
  );
  assert.equal(
    isReferrerSummary({
      referrer: "github.com",
      total_count: 12,
      last_seen: null,
    }),
    false,
  );
});

test("fetchCollectorBatchMap filters rows and falls back on bad collector responses", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];

  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));

    if (String(url).endsWith("/api/repos/id/1/traffic?days=90")) {
      return Response.json([
        {
          date: "2026-06-15",
          views_count: 10,
          views_uniques: 4,
          clones_count: 2,
          clones_uniques: 1,
        },
        { date: "2026-06-16", views_count: "bad" },
      ]);
    }

    if (String(url).endsWith("/api/repos/id/2/traffic?days=90")) {
      return new Response("not found", { status: 404 });
    }

    return Response.json({ unexpected: true });
  };

  try {
    const result = await fetchCollectorBatchMap({
      baseUrl: "https://collector.example.workers.dev/",
      repos: ["1", "2", "3"],
      buildPath: (repoId) => `/api/repos/id/${repoId}/traffic?days=90`,
      isItem: isTrafficDay,
    });

    assert.deepEqual(result, {
      "1": [
        {
          date: "2026-06-15",
          views_count: 10,
          views_uniques: 4,
          clones_count: 2,
          clones_uniques: 1,
        },
      ],
      "2": [],
      "3": [],
    });
    assert.deepEqual(requestedUrls, [
      "https://collector.example.workers.dev/api/repos/id/1/traffic?days=90",
      "https://collector.example.workers.dev/api/repos/id/2/traffic?days=90",
      "https://collector.example.workers.dev/api/repos/id/3/traffic?days=90",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
