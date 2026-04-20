#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const envFilePath = path.join(cwd, ".env.local");

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

function envValue(name, localEnv) {
  return process.env[name] || localEnv[name] || "";
}

function hasRealValue(value) {
  return Boolean(value) && !value.startsWith("your-") && !value.includes("your-collector-worker");
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

function printEnvChecklist({ baseUrl, apiSecret, triggerToken }) {
  console.log("local_env:");
  console.log(`  NEXT_PUBLIC_COLLECTOR_URL: ${hasRealValue(baseUrl) ? "ok" : "missing"}`);
  console.log(`  COLLECTOR_API_SECRET: ${hasRealValue(apiSecret) ? "ok" : "missing"}`);
  console.log(`  COLLECTOR_TRIGGER_TOKEN: ${hasRealValue(triggerToken) ? "ok" : "missing"}`);

  if (!hasRealValue(triggerToken)) {
    console.log(
      "note: COLLECTOR_TRIGGER_TOKEN is only required for the browser-side 'Sync collector' unlock flow.",
    );
  }
}

function printStatus(status) {
  console.log(`status: ${status.status}`);
  console.log(`owner: ${status.owner ?? "-"}`);
  console.log(`last_collection: ${status.last_collection?.collected_at ?? "-"}`);
  console.log(`repo_count: ${status.last_collection?.repo_count ?? "-"}`);
  console.log(`db_ready: ${status.db_stats.ready}`);
  console.log(`latest_snapshot_date: ${status.db_stats.latest_snapshot_date ?? "-"}`);
  console.log(`snapshots_count: ${status.db_stats.snapshots_count}`);
  console.log(`repos_with_history: ${status.db_stats.repos_with_history}`);
  console.log(`referrer_rows: ${status.db_stats.referrer_rows}`);

  if (status.db_stats.db_error) {
    console.log("db_error: true");
  }
}

async function main() {
  const localEnv = readLocalEnv();
  const baseUrl = envValue("NEXT_PUBLIC_COLLECTOR_URL", localEnv).replace(/\/$/, "");
  const shouldTrigger = process.argv.includes("--trigger");
  const apiSecret = envValue("COLLECTOR_API_SECRET", localEnv);
  const triggerToken = envValue("COLLECTOR_TRIGGER_TOKEN", localEnv);

  if (!baseUrl) {
    console.error("NEXT_PUBLIC_COLLECTOR_URL is missing. Set it in .env.local or the shell.");
    process.exit(1);
  }

  console.log(`collector: ${baseUrl}`);
  printEnvChecklist({ baseUrl, apiSecret, triggerToken });

  if (shouldTrigger) {
    if (!apiSecret) {
      console.error("COLLECTOR_API_SECRET is required when using --trigger.");
      process.exit(1);
    }

    const triggerResult = await requestJson(`${baseUrl}/api/collect`, {
      method: "POST",
      headers: {
        "X-API-Secret": apiSecret,
      },
    });

    console.log("manual_collect:", triggerResult);
  }

  const status = await requestJson(
    `${baseUrl}/api/status`,
    {
      headers: {
        Accept: "application/json",
      },
    },
    { allowNonOk: true },
  );

  printStatus(status);
}

main().catch((error) => {
  console.error("collector check failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
