#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const envFilePath = path.join(cwd, ".env.local");
const wranglerFilePath = path.join(cwd, "worker", "wrangler.toml");

function parseEnvFile(content) {
  const entries = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    entries[key] = value;
  }

  return entries;
}

function readLocalEnv() {
  if (!fs.existsSync(envFilePath)) {
    return {};
  }

  return parseEnvFile(fs.readFileSync(envFilePath, "utf8"));
}

function parseWranglerToml() {
  if (!fs.existsSync(wranglerFilePath)) {
    return {
      exists: false,
      workerName: "",
      githubUsername: "",
      d1DatabaseId: "",
      kvNamespaceId: "",
      cronConfigured: false,
    };
  }

  const content = fs.readFileSync(wranglerFilePath, "utf8");
  const readFirst = (regex) => content.match(regex)?.[1] ?? "";
  const readFirstInArraySection = (sectionName, keyName) => {
    const escapedSection = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sectionRegex = new RegExp(`^\\[\\[${escapedSection}\\]\\]([\\s\\S]*?)(?=^\\[|\\Z)`, "m");
    const sectionBody = content.match(sectionRegex)?.[1] ?? "";
    const valueRegex = new RegExp(`^\\s*${keyName}\\s*=\\s*"([^"]+)"`, "m");
    return sectionBody.match(valueRegex)?.[1] ?? "";
  };

  return {
    exists: true,
    workerName: readFirst(/^name\s*=\s*"([^"]+)"/m),
    githubUsername: readFirst(/^GITHUB_USERNAME\s*=\s*"([^"]+)"/m),
    d1DatabaseId: readFirstInArraySection("d1_databases", "database_id"),
    kvNamespaceId: readFirstInArraySection("kv_namespaces", "id"),
    cronConfigured: /\[triggers\][\s\S]*?crons\s*=\s*\[[^\]]+\]/m.test(content),
  };
}

function envValue(name, localEnv) {
  return process.env[name] || localEnv[name] || "";
}

function hasRealValue(value) {
  return Boolean(value) && !value.startsWith("your-") && !value.includes("your-collector-worker");
}

function hasLikelyId(value) {
  return hasRealValue(value) && value.length >= 8;
}

async function requestJson(url, init, options = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  const { allowNonOk = false } = options;

  if (!response.ok && !allowNonOk) {
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }

  return data;
}

function printEnvChecklist({ baseUrl, apiSecret, triggerToken, githubUsername }) {
  const triggerTokenEffective = hasRealValue(triggerToken) || hasRealValue(apiSecret);

  console.log("local_env:");
  console.log(`  GITHUB_USERNAME: ${hasRealValue(githubUsername) ? "ok" : "missing"}`);
  console.log(`  NEXT_PUBLIC_COLLECTOR_URL: ${hasRealValue(baseUrl) ? "ok" : "missing"}`);
  console.log(`  COLLECTOR_API_SECRET: ${hasRealValue(apiSecret) ? "ok" : "missing"}`);
  console.log(
    `  COLLECTOR_TRIGGER_TOKEN: ${hasRealValue(triggerToken) ? "ok" : triggerTokenEffective ? "optional (fallback to COLLECTOR_API_SECRET)" : "missing"}`,
  );

  if (!hasRealValue(triggerToken) && triggerTokenEffective) {
    console.log(
      "note: browser-side 'Sync collector' unlock uses COLLECTOR_API_SECRET fallback when COLLECTOR_TRIGGER_TOKEN is missing.",
    );
  }
}

function printWranglerChecklist(wrangler) {
  console.log("worker_config:");

  if (!wrangler.exists) {
    console.log("  wrangler.toml: missing");
    return;
  }

  console.log(`  worker_name: ${hasRealValue(wrangler.workerName) ? wrangler.workerName : "missing"}`);
  console.log(
    `  GITHUB_USERNAME (vars): ${hasRealValue(wrangler.githubUsername) ? wrangler.githubUsername : "missing"}`,
  );
  console.log(`  D1 database_id: ${hasLikelyId(wrangler.d1DatabaseId) ? "ok" : "missing"}`);
  console.log(`  KV namespace id: ${hasLikelyId(wrangler.kvNamespaceId) ? "ok" : "missing"}`);
  console.log(`  cron trigger: ${wrangler.cronConfigured ? "ok" : "missing"}`);
}

function printStatus(status) {
  if (!status || typeof status !== "object") {
    console.log("status: invalid payload");
    console.log(`raw: ${String(status)}`);
    return;
  }

  console.log(`status: ${status.status}`);
  console.log(`owner: ${status.owner ?? "-"}`);
  console.log(`last_collection: ${status.last_collection?.collected_at ?? "-"}`);
  console.log(`repo_count: ${status.last_collection?.repo_count ?? "-"}`);
  console.log(`db_ready: ${status.db_stats?.ready ?? "-"}`);
  console.log(`latest_snapshot_date: ${status.db_stats?.latest_snapshot_date ?? "-"}`);
  console.log(`snapshots_count: ${status.db_stats?.snapshots_count ?? "-"}`);
  console.log(`repos_with_history: ${status.db_stats?.repos_with_history ?? "-"}`);
  console.log(`referrer_rows: ${status.db_stats?.referrer_rows ?? "-"}`);

  if (status.db_stats?.db_error) {
    console.log("db_error: true");
  }

  if (status.runtime_config) {
    console.log("runtime_config:");
    console.log(
      `  github_username_configured: ${status.runtime_config.github_username_configured ? "ok" : "missing"}`,
    );
    console.log(
      `  github_token_configured: ${status.runtime_config.github_token_configured ? "ok" : "missing"}`,
    );
    console.log(
      `  api_secret_configured: ${status.runtime_config.api_secret_configured ? "ok" : "missing"}`,
    );
    console.log(
      `  d1_binding_configured: ${status.runtime_config.d1_binding_configured ? "ok" : "missing"}`,
    );
    console.log(
      `  kv_binding_configured: ${status.runtime_config.kv_binding_configured ? "ok" : "missing"}`,
    );
  }
}

function printActionableHints({
  status,
  baseUrl,
  apiSecret,
  githubUsername,
  wrangler,
}) {
  const actions = [];

  if (!hasRealValue(baseUrl) || !hasRealValue(apiSecret)) {
    actions.push("bash scripts/setup-collector-secrets.sh");
  }

  if (!hasRealValue(githubUsername) && hasRealValue(wrangler.githubUsername)) {
    actions.push(`echo 'GITHUB_USERNAME="${wrangler.githubUsername}"' >> .env.local`);
  }

  if (!hasRealValue(wrangler.githubUsername)) {
    actions.push("worker/wrangler.toml の [vars] に GITHUB_USERNAME を設定");
  }

  if (!hasLikelyId(wrangler.d1DatabaseId)) {
    actions.push("worker/wrangler.toml の [[d1_databases]] database_id を確認");
  }

  if (!hasLikelyId(wrangler.kvNamespaceId)) {
    actions.push("worker/wrangler.toml の [[kv_namespaces]] id を確認");
  }

  const runtime = status?.runtime_config ?? {};
  if (runtime.github_token_configured === false) {
    actions.push("cd worker && wrangler secret put GITHUB_TOKEN");
  }
  if (runtime.api_secret_configured === false) {
    actions.push("cd worker && wrangler secret put API_SECRET");
  }

  const shouldSuggestVercelSync =
    !hasRealValue(baseUrl) ||
    !hasRealValue(apiSecret) ||
    runtime.api_secret_configured === false ||
    runtime.github_token_configured === false;

  if (shouldSuggestVercelSync) {
    actions.push("npm run collector:push:vercel-env");
    actions.push("npm run collector:check:vercel-env");
  }

  const uniqueActions = [...new Set(actions)];

  if (uniqueActions.length === 0) {
    return;
  }

  console.log("next_actions:");
  for (const action of uniqueActions) {
    console.log(`  - ${action}`);
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const shouldTrigger = args.has("--trigger");
  const offlineMode = args.has("--offline");

  if (shouldTrigger && offlineMode) {
    console.error("--trigger and --offline cannot be used together.");
    process.exit(1);
  }

  const localEnv = readLocalEnv();
  const wrangler = parseWranglerToml();
  const baseUrl = envValue("NEXT_PUBLIC_COLLECTOR_URL", localEnv).replace(/\/$/, "");
  const apiSecret = envValue("COLLECTOR_API_SECRET", localEnv);
  const triggerToken = envValue("COLLECTOR_TRIGGER_TOKEN", localEnv);
  const githubUsername = envValue("GITHUB_USERNAME", localEnv);

  console.log(`collector: ${hasRealValue(baseUrl) ? baseUrl : "(not configured)"}`);
  printEnvChecklist({ baseUrl, apiSecret, triggerToken, githubUsername });
  printWranglerChecklist(wrangler);

  if (offlineMode) {
    console.log("mode: offline (skipped /api/status and /api/collect)");
    printActionableHints({
      status: null,
      baseUrl,
      apiSecret,
      githubUsername,
      wrangler,
    });

    const hasBlockingLocalGaps =
      !hasRealValue(baseUrl) ||
      !hasRealValue(apiSecret) ||
      !hasRealValue(wrangler.githubUsername) ||
      !hasLikelyId(wrangler.d1DatabaseId) ||
      !hasLikelyId(wrangler.kvNamespaceId);

    process.exit(hasBlockingLocalGaps ? 1 : 0);
  }

  if (!hasRealValue(baseUrl)) {
    console.error("NEXT_PUBLIC_COLLECTOR_URL is missing. Set it in .env.local or the shell.");
    process.exit(1);
  }

  if (shouldTrigger) {
    if (!hasRealValue(apiSecret)) {
      console.error("COLLECTOR_API_SECRET is required when using --trigger.");
      process.exit(1);
    }

    try {
      const triggerResult = await requestJson(`${baseUrl}/api/collect`, {
        method: "POST",
        headers: {
          "X-API-Secret": apiSecret,
        },
      });

      console.log("manual_collect:", triggerResult);
    } catch (error) {
      console.error("/api/collect request failed:", error instanceof Error ? error.message : error);
      printActionableHints({
        status: null,
        baseUrl,
        apiSecret,
        githubUsername,
        wrangler,
      });
      process.exit(1);
    }
  }

  try {
    const statusHeaders = {
      Accept: "application/json",
      ...(hasRealValue(apiSecret) ? { "X-API-Secret": apiSecret } : {}),
    };

    const status = await requestJson(
      `${baseUrl}/api/status`,
      {
        headers: statusHeaders,
      },
      { allowNonOk: true },
    );

    printStatus(status);
    printActionableHints({
      status,
      baseUrl,
      apiSecret,
      githubUsername,
      wrangler,
    });
  } catch (error) {
    console.error("/api/status request failed:", error instanceof Error ? error.message : error);
    console.log("fallback: local-only preflight summary");
    printActionableHints({
      status: null,
      baseUrl,
      apiSecret,
      githubUsername,
      wrangler,
    });
    process.exit(1);
  }
}

main();
