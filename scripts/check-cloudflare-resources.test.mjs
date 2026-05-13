import assert from "node:assert/strict";
import test from "node:test";

import {
  hasSecret,
  listItems,
  objectId,
  objectName,
  parseJsonFromOutput,
  stripAnsi,
} from "./check-cloudflare-resources.mjs";

test("parseJsonFromOutput accepts raw JSON", () => {
  assert.deepEqual(parseJsonFromOutput('[{"name":"repo-radar-kv"}]'), [
    { name: "repo-radar-kv" },
  ]);
});

test("parseJsonFromOutput skips Wrangler preamble before JSON", () => {
  assert.deepEqual(
    parseJsonFromOutput('Logged in as akina910\n[{"name":"GITHUB_TOKEN"}]\n'),
    [{ name: "GITHUB_TOKEN" }],
  );
});

test("listItems reads Wrangler result wrappers and arrays", () => {
  assert.deepEqual(listItems([{ id: "direct" }]), [{ id: "direct" }]);
  assert.deepEqual(listItems({ result: [{ id: "wrapped" }] }), [{ id: "wrapped" }]);
  assert.deepEqual(listItems({ result: "not-array" }), []);
});

test("objectId and objectName normalize known Cloudflare fields", () => {
  assert.equal(objectId({ uuid: "db-uuid" }), "db-uuid");
  assert.equal(objectId({ id: "namespace-id" }), "namespace-id");
  assert.equal(objectId({ database_id: "database-id" }), "database-id");
  assert.equal(objectName({ title: "repo-radar-db" }), "repo-radar-db");
  assert.equal(objectName({ name: "repo-radar-kv" }), "repo-radar-kv");
});

test("hasSecret matches only secret names", () => {
  const secrets = [
    { name: "GITHUB_TOKEN" },
    { name: "API_SECRET" },
  ];

  assert.equal(hasSecret(secrets, "GITHUB_TOKEN"), true);
  assert.equal(hasSecret(secrets, "MISSING_SECRET"), false);
});

test("stripAnsi removes color codes from Wrangler errors", () => {
  assert.equal(stripAnsi("\u001b[31merror\u001b[0m"), "error");
});
