import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { extractBlocks } from "../dist/markdown.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist/cli.js");
const doc = path.join(root, "examples/docs/fetch-block.mdx");

function scanJson(target, extra = []) {
  try {
    return JSON.parse(execFileSync("node", [cli, "scan", target, "--format", "json", "--fail-on", "none", ...extra], { encoding: "utf8" }));
  } catch (e) {
    assert.fail(e.stdout || e.message);
  }
}

test("extractBlocks: JS/TS fences, JSON fences and curl bodies, at exact offsets", () => {
  const md = [
    "# t",
    "```ts title=\"a.ts\"",
    "const a = 1;",
    "```",
    "  ```javascript",
    "  b();",
    "  ```",
    "```bash",
    "curl x -d '{\"method\":\"getBlock\",\"params\":[1]}'",
    "```",
    "```json",
    "{ \"result\": 1 }",
    "```",
    "```rust",
    "let x = 0;",
    "```",
    "",
  ].join("\n");
  const blocks = extractBlocks(md);
  assert.deepEqual(blocks.map((b) => b.ext), ["ts", "js", "js"]);
  assert.equal(md.slice(blocks[0].offset, blocks[0].offset + blocks[0].text.length), blocks[0].text);
  assert.equal(blocks[1].text, "  b();\n");
  assert.equal(blocks[2].text, '({"method":"getBlock","params":[1]})');
  assert.equal(md[blocks[2].offset + 1], "{");
});

test("extractBlocks: a fence is closed only by the same fence character and length", () => {
  const md = "````md\n```ts\nx\n```\n````\n```ts\ny()\n```\n";
  const blocks = extractBlocks(md);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].text, "y()\n");
});

test("scan reports findings in .mdx code blocks at document positions", () => {
  const report = scanJson(doc);
  const at = report.findings.map((f) => `${f.line}:${f.column}:${f.fixable}`);
  assert.deepEqual(at, ["10:53:true", "16:18:false", "27:77:true"]);
  assert.equal(report.parseErrors.length, 0, "partial snippets are not parse errors");
});

test("--no-docs skips Markdown", () => {
  assert.equal(scanJson(path.dirname(doc), ["--no-docs"]).findings.length, 0);
});

test("--fix rewrites 0 -> 1 inside the document and leaves the rest untouched", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sucmd-"));
  const file = path.join(dir, "fetch-block.mdx");
  copyFileSync(doc, file);
  execFileSync("node", [cli, "scan", dir, "--fix", "--fail-on", "none"], { encoding: "utf8" });
  const before = readFileSync(doc, "utf8").split("\n");
  const after = readFileSync(file, "utf8").split("\n");
  assert.equal(after.length, before.length);
  const changed = before.map((l, i) => (l === after[i] ? null : i + 1)).filter(Boolean);
  assert.deepEqual(changed, [10, 27]);
  assert.match(after[9], /maxSupportedTransactionVersion: 1 \}/);
  assert.match(after[26], /"maxSupportedTransactionVersion": 1 \}/);
});

test("JSON samples only get the request rule, and non-Solana docs need an import", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sucmd-"));
  writeFileSync(
    path.join(dir, "notification.md"),
    '# Solana\n\n```json\n{ "method": "accountNotification", "params": { "lamports": 1169280 } }\n```\n',
  );
  writeFileSync(path.join(dir, "other.md"), "# Ethereum\n\n```js\nawait provider.getTransaction(hash);\n```\n");
  assert.equal(scanJson(dir).findings.length, 0);
});
