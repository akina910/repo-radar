#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = process.cwd();
const workerDir = path.join(rootDir, "worker");
const wranglerFilePath = path.join(workerDir, "wrangler.toml");
const requiredSecrets = new Set(["GITHUB_TOKEN", "API_SECRET"]);

function parseWranglerToml() {
  if (!fs.existsSync(wranglerFilePath)) {
    return {
      exists: false,
      workerName: "",
      githubUsername: "",
      d1DatabaseName: "",
      d1DatabaseId: "",
      kvNamespaceId: "",
      cronConfigured: false,
    };
  }

  const content = fs.readFileSync(wranglerFilePath, "utf8");
  const readFirst = (regex) => content.match(regex)?.[1] ?? "";
  const readFirstInArraySection = (sectionName, keyName) => {
    const escapedSection = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sectionRegex = new RegExp(`\\[\\[${escapedSection}\\]\\]([\\s\\S]*?)(?=\\n\\[|$)`);
    const sectionBody = content.match(sectionRegex)?.[1] ?? "";
    const valueRegex = new RegExp(`^\\s*${keyName}\\s*=\\s*"([^"]+)"`, "m");
    return sectionBody.match(valueRegex)?.[1] ?? "";
  };

  return {
    exists: true,
    workerName: readFirst(/^name\s*=\s*"([^"]+)"/m),
    githubUsername: readFirst(/^GITHUB_USERNAME\s*=\s*"([^"]+)"/m),
    d1DatabaseName: readFirstInArraySection("d1_databases", "database_name"),
    d1DatabaseId: readFirstInArraySection("d1_databases", "database_id"),
    kvNamespaceId: readFirstInArraySection("kv_namespaces", "id"),
    cronConfigured: /\[triggers\][\s\S]*?crons\s*=\s*\[[^\]]+\]/m.test(content),
  };
}

function parseJsonFromOutput(output) {
  const trimmed = output.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const jsonStart = trimmed.search(/[[{]/);
    if (jsonStart === -1) {
      return null;
    }

    try {
      return JSON.parse(trimmed.slice(jsonStart));
    } catch {
      return null;
    }
  }
}

function runWrangler(args) {
  const logPath =
    process.env.WRANGLER_LOG_PATH ?? path.join(os.tmpdir(), "repo-radar-wrangler-logs");
  fs.mkdirSync(logPath, { recursive: true });

  const result = spawnSync("wrangler", args, {
    cwd: workerDir,
    encoding: "utf8",
    env: {
      ...process.env,
      WRANGLER_LOG_PATH: logPath,
      NO_COLOR: "1",
    },
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.error?.message ?? result.stderr ?? "",
    json: parseJsonFromOutput(result.stdout ?? ""),
  };
}

function objectId(value) {
  if (!value || typeof value !== "object") {
    return "";
  }

  return String(value.uuid ?? value.id ?? value.database_id ?? "");
}

function objectName(value) {
  if (!value || typeof value !== "object") {
    return "";
  }

  return String(value.name ?? value.title ?? "");
}

function listItems(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object" && Array.isArray(value.result)) {
    return value.result;
  }

  return [];
}

function hasSecret(secrets, name) {
  return secrets.some((secret) => objectName(secret) === name);
}

function readCommandMessage(result) {
  return stripAnsi(`${result.stderr || result.stdout}`).trim();
}

function isCloudflareApiUnavailable(result) {
  const message = readCommandMessage(result).toLowerCase();
  const cloudflareApiMentioned =
    message.includes("api.cloudflare.com") || message.includes("dash.cloudflare.com");

  const networkFailureMentioned = [
    "unable to resolve cloudflare's api hostname",
    "getaddrinfo",
    "enotfound",
    "eai_again",
    "etimedout",
    "fetch failed",
    "failed to fetch",
    "network connectivity",
    "no internet connection",
  ].some((needle) => message.includes(needle));

  return networkFailureMentioned || (cloudflareApiMentioned && message.includes("dns"));
}

function printCommandFailure(label, result) {
  console.log(`${label}: unverified`);
  const message = readCommandMessage(result)
    .split(/\r?\n/)
    .slice(0, 8)
    .join("\n");
  if (message) {
    console.log(message);
  }
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function main() {
  const config = parseWranglerToml();

  console.log("cloudflare_config:");
  console.log(`  wrangler.toml: ${config.exists ? "ok" : "missing"}`);
  console.log(`  worker_name: ${config.workerName || "missing"}`);
  console.log(`  GITHUB_USERNAME: ${config.githubUsername || "missing"}`);
  console.log(`  D1 database_name: ${config.d1DatabaseName || "missing"}`);
  console.log(`  D1 database_id: ${config.d1DatabaseId || "missing"}`);
  console.log(`  KV namespace_id: ${config.kvNamespaceId || "missing"}`);
  console.log(`  cron trigger: ${config.cronConfigured ? "ok" : "missing"}`);

  if (!config.exists || !config.workerName || !config.d1DatabaseId || !config.kvNamespaceId) {
    console.log("next_actions:");
    console.log("  - Fix worker/wrangler.toml before checking remote Cloudflare resources.");
    process.exit(1);
  }

  let ok = true;
  let cloudflareApiUnavailable = false;

  const whoami = runWrangler(["whoami"]);
  if (!whoami.ok) {
    ok = false;
    cloudflareApiUnavailable ||= isCloudflareApiUnavailable(whoami);
    printCommandFailure("account", whoami);
  } else {
    console.log("account: ok");
  }

  const deployments = runWrangler([
    "deployments",
    "list",
    "--name",
    config.workerName,
    "--json",
  ]);
  if (!deployments.ok) {
    ok = false;
    cloudflareApiUnavailable ||= isCloudflareApiUnavailable(deployments);
    printCommandFailure("worker_deployments", deployments);
  } else {
    const deploymentCount = listItems(deployments.json).length;
    console.log(`worker_deployments: ${deploymentCount > 0 ? "ok" : "missing"} (${deploymentCount} recent)`);
    ok = ok && deploymentCount > 0;
  }

  const d1 = runWrangler(["d1", "list", "--json"]);
  if (!d1.ok) {
    ok = false;
    cloudflareApiUnavailable ||= isCloudflareApiUnavailable(d1);
    printCommandFailure("d1_database", d1);
  } else {
    const databases = listItems(d1.json);
    const found = databases.some(
      (database) =>
        objectId(database) === config.d1DatabaseId ||
        objectName(database) === config.d1DatabaseName,
    );
    console.log(`d1_database: ${found ? "ok" : "missing"}`);
    ok = ok && found;
  }

  const kv = runWrangler(["kv", "namespace", "list"]);
  if (!kv.ok) {
    ok = false;
    cloudflareApiUnavailable ||= isCloudflareApiUnavailable(kv);
    printCommandFailure("kv_namespace", kv);
  } else {
    const namespaces = listItems(kv.json);
    const found = namespaces.some((namespace) => objectId(namespace) === config.kvNamespaceId);
    console.log(`kv_namespace: ${found ? "ok" : "missing"}`);
    ok = ok && found;
  }

  const secrets = runWrangler(["secret", "list", "--name", config.workerName, "--format", "json"]);
  if (!secrets.ok) {
    ok = false;
    cloudflareApiUnavailable ||= isCloudflareApiUnavailable(secrets);
    printCommandFailure("worker_secrets", secrets);
  } else {
    const secretItems = listItems(secrets.json);
    const missingSecrets = [...requiredSecrets].filter((name) => !hasSecret(secretItems, name));
    console.log(`worker_secrets: ${missingSecrets.length === 0 ? "ok" : "missing"}`);
    if (missingSecrets.length > 0) {
      console.log(`missing_worker_secrets: ${missingSecrets.join(", ")}`);
      ok = false;
    }
  }

  if (!ok) {
    console.log("next_actions:");
    if (cloudflareApiUnavailable) {
      console.log(
        "  - Cloudflare API could not be reached from this environment; rerun with network/DNS access or verify via Cloudflare MCP.",
      );
      console.log("  - Then rerun: npm run collector:check:cloudflare");
    } else {
      console.log("  - Run: npm run collector:bootstrap");
      console.log("  - Then rerun: npm run collector:check:cloudflare");
    }
    process.exit(1);
  }

  console.log("cloudflare_resources: ok");
}

export {
  hasSecret,
  isCloudflareApiUnavailable,
  listItems,
  objectId,
  objectName,
  parseJsonFromOutput,
  readCommandMessage,
  stripAnsi,
};

if (
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))
) {
  main();
}
