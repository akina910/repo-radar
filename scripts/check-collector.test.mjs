import assert from "node:assert/strict";
import test from "node:test";

import {
  hasRealValue,
  millisecondsSinceCollectorDate,
  parseEnvFile,
  readBlockingStatusIssues,
  readCollectorFreshness,
  readUrlIssue,
} from "./check-collector.mjs";

test("parseEnvFile ignores comments and preserves quoted values", () => {
  assert.deepEqual(
    parseEnvFile(`
      # comment
      GITHUB_USERNAME=akina910
      NEXT_PUBLIC_COLLECTOR_URL="https://repo-radar-collector.example.workers.dev"
      EMPTY=
      INVALID_LINE
    `),
    {
      GITHUB_USERNAME: "akina910",
      NEXT_PUBLIC_COLLECTOR_URL: "https://repo-radar-collector.example.workers.dev",
      EMPTY: "",
    },
  );
});

test("hasRealValue rejects placeholders used by env examples", () => {
  assert.equal(hasRealValue("akina910"), true);
  assert.equal(hasRealValue("your-api-secret"), false);
  assert.equal(hasRealValue("https://your-collector-worker.workers.dev"), false);
  assert.equal(hasRealValue(""), false);
});

test("readUrlIssue requires a bare HTTP(S) Worker origin", () => {
  assert.equal(
    readUrlIssue("https://repo-radar-collector.kiyo-nomura.workers.dev"),
    "",
  );
  assert.equal(readUrlIssue("https://your-collector-worker.workers.dev"), "missing");
  assert.equal(
    readUrlIssue("https://repo-radar-collector.workers.dev"),
    "missing workers.dev account subdomain",
  );
  assert.equal(
    readUrlIssue("https://repo-radar-collector.kiyo-nomura.workers.dev/api/status"),
    "must be a bare origin",
  );
  assert.equal(
    readUrlIssue("ftp://repo-radar-collector.kiyo-nomura.workers.dev"),
    "must use http or https",
  );
  assert.equal(readUrlIssue("not a url"), "invalid URL");
});

test("collector freshness reads latest D1 date before KV collection timestamp", () => {
  const status = {
    last_collection: { collected_at: "2026-01-10T00:00:00.000Z" },
    db_stats: { latest_snapshot_date: "2026-01-11" },
  };

  assert.equal(readCollectorFreshness(status).latestDate, "2026-01-11");
});

test("millisecondsSinceCollectorDate handles ISO and YYYY-MM-DD values", () => {
  assert.equal(millisecondsSinceCollectorDate("not a date"), null);
  assert.equal(typeof millisecondsSinceCollectorDate("2026-01-11"), "number");
  assert.equal(typeof millisecondsSinceCollectorDate("2026-01-11T00:00:00.000Z"), "number");
});

test("readBlockingStatusIssues keeps a healthy collector clean", () => {
  assert.deepEqual(
    readBlockingStatusIssues({
      status: "ok",
      kv_error: false,
      db_stats: { ready: true, db_error: false, latest_snapshot_date: "2999-01-01" },
      runtime_config: {
        github_username_configured: true,
        github_token_configured: true,
        api_secret_configured: true,
        d1_binding_configured: true,
        kv_binding_configured: true,
      },
    }),
    [],
  );
});

test("readBlockingStatusIssues fails degraded runtime and storage states", () => {
  const issues = readBlockingStatusIssues({
    status: "degraded",
    kv_error: true,
    db_stats: { ready: false, db_error: true, latest_snapshot_date: null },
    runtime_config: {
      github_username_configured: true,
      github_token_configured: false,
      api_secret_configured: false,
      d1_binding_configured: true,
      kv_binding_configured: false,
    },
  });

  assert.deepEqual(issues, [
    "collector status is degraded",
    "collector KV read failed",
    "collector D1 read failed",
    "runtime_config.github_token_configured is missing",
    "runtime_config.api_secret_configured is missing",
    "runtime_config.kv_binding_configured is missing",
  ]);
});

test("readBlockingStatusIssues fails malformed ok payloads", () => {
  assert.deepEqual(
    readBlockingStatusIssues({
      status: "ok",
    }),
    [
      "collector KV status is missing",
      "collector D1 read failed",
      "runtime_config.github_username_configured is missing",
      "runtime_config.github_token_configured is missing",
      "runtime_config.api_secret_configured is missing",
      "runtime_config.d1_binding_configured is missing",
      "runtime_config.kv_binding_configured is missing",
    ],
  );
});

test("readBlockingStatusIssues fails stale collector history", () => {
  const issues = readBlockingStatusIssues({
    status: "ok",
    kv_error: false,
    db_stats: { ready: true, db_error: false, latest_snapshot_date: "2000-01-01" },
    runtime_config: {
      github_username_configured: true,
      github_token_configured: true,
      api_secret_configured: true,
      d1_binding_configured: true,
      kv_binding_configured: true,
    },
  });

  assert.equal(issues.length, 1);
  assert.match(issues[0], /^collector data is stale \(\d+ days old\)$/);
});
