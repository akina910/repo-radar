import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const rootDir = path.resolve(import.meta.dirname, "..");
const scriptPath = path.join(rootDir, "scripts", "check-vercel-collector-env.sh");

function runCheckWithFakeVercel(envBody) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-radar-vercel-env-test-"));
  const binDir = path.join(tmpDir, "bin");
  fs.mkdirSync(binDir, { recursive: true });

  const fakeVercelPath = path.join(binDir, "vercel");
  fs.writeFileSync(
    fakeVercelPath,
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" != "env" || "$2" != "pull" ]]; then
  echo "unexpected vercel args: $*" >&2
  exit 1
fi
cat > "$3" <<'EOF'
${envBody}
EOF
`,
    { mode: 0o755 },
  );

  try {
    return spawnSync("bash", [scriptPath], {
      cwd: rootDir,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
      },
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

test("check-vercel-collector-env accepts real collector env values", () => {
  const result = runCheckWithFakeVercel(`
NEXT_PUBLIC_COLLECTOR_URL="https://repo-radar-collector.kiyo-nomura.workers.dev"
COLLECTOR_API_SECRET="secret-value"
COLLECTOR_TRIGGER_TOKEN="trigger-value"
`);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Required collector envs are present in Vercel\./);
});

test("check-vercel-collector-env rejects placeholders as missing", () => {
  const result = runCheckWithFakeVercel(`
NEXT_PUBLIC_COLLECTOR_URL="https://your-collector-worker.workers.dev"
COLLECTOR_API_SECRET="your-api-secret"
COLLECTOR_TRIGGER_TOKEN="your-trigger-token"
`);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stdout, /NEXT_PUBLIC_COLLECTOR_URL: missing or placeholder/);
  assert.match(result.stdout, /COLLECTOR_API_SECRET: missing or placeholder/);
});

test("check-vercel-collector-env rejects malformed collector URLs", () => {
  const result = runCheckWithFakeVercel(`
NEXT_PUBLIC_COLLECTOR_URL="https://repo-radar-collector.workers.dev/api/status"
COLLECTOR_API_SECRET="secret-value"
`);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.match(result.stdout, /NEXT_PUBLIC_COLLECTOR_URL: must be a bare http\(s\) origin/);
});
