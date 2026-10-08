import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist/cli.js");
const example = path.join(root, "examples/legacy-app");

function run(args) {
  try {
    return { code: 0, out: execFileSync("node", [cli, ...args], { encoding: "utf8" }) };
  } catch (e) {
    return { code: e.status, out: e.stdout };
  }
}

test("scan --format json finds every rule category in the example app", () => {
  const { code, out } = run(["scan", example, "--format", "json"]);
  assert.equal(code, 1, "errors (package.json) => exit code 1");
  const report = JSON.parse(out);
  const rules = new Set(report.findings.map((f) => f.ruleId.split("/")[1]));
  for (const r of [
    "require-max-supported-transaction-version",
    "no-compute-budget-only-parsing",
    "no-hardcoded-rent-exempt",
    "no-hardcoded-slot-duration",
    "no-wallclock-blockhash-expiry",
    "no-hardcoded-sol-suffix",
    "no-legacy-sns-api",
    "no-closed-reward-type",
    "min-v1-sdk-version",
    "min-sns-sdk-version",
  ]) assert.ok(rules.has(r), `missing ${r}`);
  assert.equal(report.parseErrors.length, 0);
});

test("scan --format sarif emits valid SARIF 2.1.0 skeleton", () => {
  const { out } = run(["scan", example, "--format", "sarif", "--fail-on", "none"]);
  const sarif = JSON.parse(out);
  assert.equal(sarif.version, "2.1.0");
  assert.equal(sarif.runs[0].tool.driver.rules.length, 10);
  for (const r of sarif.runs[0].results) {
    assert.ok(r.ruleIndex >= 0);
    assert.ok(r.locations[0].physicalLocation.region.startLine >= 1);
    assert.ok(!path.isAbsolute(r.locations[0].physicalLocation.artifactLocation.uri));
  }
});

test("scan exits 0 on a clean tree", () => {
  const { code, out } = run(["scan", path.join(root, "src/sources.ts")]);
  assert.equal(code, 0, out);
});
