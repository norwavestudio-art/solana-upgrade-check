#!/usr/bin/env node
import { ESLint, type Linter } from "eslint";
import { existsSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import plugin, { CODE_FILES, DOC_FILES, PKG_FILES, PLUGIN_NAME } from "./index.js";
import { toSarif } from "./sarif.js";
import { decodeFeatureAccount, epochOfSlot, FEATURE_GATES, firstSlotOfEpoch, type EpochSchedule } from "./features.js";
import { VERIFIED_ON } from "./sources.js";

const VERSION = "0.1.0";

// The scanned repo's own .eslintignore is irrelevant to us (we never load its ESLint config).
const originalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning: any, ...rest: any[]) => {
  const type = typeof rest[0] === "string" ? rest[0] : rest[0]?.type;
  if (type === "ESLintIgnoreWarning") return;
  return (originalEmitWarning as any)(warning, ...rest);
}) as typeof process.emitWarning;

const CLUSTERS: Record<string, string> = {
  mainnet: "https://api.mainnet-beta.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
};

/** Test files, mocks and fixtures: excluded unless --include-tests. */
export const TEST_IGNORES = [
  "**/__tests__/**",
  "**/__mocks__/**",
  "**/__typetests__/**",
  "**/*.typetest.*",
  "**/*-typetest.*",
  "**/mocks/**",
  "**/fixtures/**",
  "**/test/**",
  "**/tests/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/.storybook/**",
  "**/__stories__/**",
  "**/*.stories.*",
];

export const DEFAULT_IGNORES = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/out/**",
  "**/.next/**",
  "**/coverage/**",
  "**/target/**",
  "**/vendor/**",
  "**/*.min.js",
  "**/*.bundle.js",
  // Changelogs quote old APIs on purpose.
  "**/CHANGELOG.md",
];

const HELP = `solana-upgrade-check ${VERSION}

Usage:
  solana-upgrade-check scan <path> [--format text|json|sarif] [--output <file>]
                                   [--fix] [--fail-on error|warning|none] [--ignore <glob>]...
                                   [--include-tests] [--no-docs]
  solana-upgrade-check status [--rpc <url> | --cluster mainnet|devnet|testnet] [--json]
  solana-upgrade-check rules

scan also checks code blocks in .md / .mdx files (JS/TS, JSON and curl JSON-RPC
bodies); --no-docs turns that off.

Rules and their primary sources were verified on ${VERIFIED_ON}.
`;

interface Args {
  _: string[];
  [k: string]: string | boolean | string[];
}

function parseArgs(argv: string[]): Args {
  const out: Args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, inline] = a.slice(2).split("=", 2);
      const next = argv[i + 1];
      const val = inline ?? (next !== undefined && !next.startsWith("--") ? (i++, next) : true);
      if (k === "ignore") {
        const prev = (out.ignore as string[] | undefined) ?? [];
        out.ignore = [...prev, String(val)];
      } else out[k] = val;
    } else out._.push(a);
  }
  return out;
}

export interface Finding {
  ruleId: string;
  severity: "error" | "warning";
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  fixable: boolean;
  hasSuggestions: boolean;
  helpUri?: string;
}

export async function scan(
  target: string,
  opts: { fix?: boolean; ignore?: string[]; includeTests?: boolean; docs?: boolean } = {},
): Promise<{ findings: Finding[]; filesScanned: number; parseErrors: { file: string; message: string }[] }> {
  const root = path.resolve(target);
  const isFile = statSync(root).isFile();
  const cwd = isFile ? path.dirname(root) : root;
  const config: Linter.Config[] = [
    { ignores: [...DEFAULT_IGNORES, ...(opts.includeTests ? [] : TEST_IGNORES), ...(opts.ignore ?? [])] },
    ...plugin.configs.recommended,
    ...(opts.docs === false ? [] : plugin.configs.markdown),
  ];
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: config,
    fix: !!opts.fix,
    errorOnUnmatchedPattern: false,
    warnIgnored: false,
  });
  const results = await eslint.lintFiles(isFile ? [root] : [...CODE_FILES, ...PKG_FILES, ...(opts.docs === false ? [] : DOC_FILES)]);
  if (opts.fix) await ESLint.outputFixes(results);
  const findings: Finding[] = [];
  const parseErrors: { file: string; message: string }[] = [];
  const meta = plugin.rules as Record<string, any>;
  for (const r of results) {
    const rel = path.relative(cwd, r.filePath).split(path.sep).join("/");
    for (const m of r.messages) {
      if (!m.ruleId) {
        if (m.fatal) parseErrors.push({ file: rel, message: m.message });
        continue;
      }
      if (!m.ruleId.startsWith(PLUGIN_NAME + "/")) continue;
      const short = m.ruleId.slice(PLUGIN_NAME.length + 1);
      findings.push({
        ruleId: m.ruleId,
        severity: m.severity === 2 ? "error" : "warning",
        file: rel,
        line: m.line,
        column: m.column,
        endLine: m.endLine,
        endColumn: m.endColumn,
        message: m.message,
        fixable: !!m.fix,
        hasSuggestions: !!m.suggestions?.length,
        helpUri: meta[short]?.meta?.docs?.url,
      });
    }
  }
  return { findings, filesScanned: results.length, parseErrors };
}

function formatText(findings: Finding[], filesScanned: number, parseErrors: { file: string }[]): string {
  const lines: string[] = [];
  const byFile = new Map<string, Finding[]>();
  for (const f of findings) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
  for (const [file, fs] of byFile) {
    lines.push(file);
    for (const f of fs) {
      const tag = f.fixable ? " [fixable]" : f.hasSuggestions ? " [suggestion]" : "";
      lines.push(`  ${f.line}:${f.column}  ${f.severity.padEnd(7)}  ${f.message}  ${f.ruleId}${tag}`);
    }
    lines.push("");
  }
  const errors = findings.filter((f) => f.severity === "error").length;
  lines.push(
    `${findings.length} finding(s) (${errors} error, ${findings.length - errors} warning) in ${byFile.size} file(s); ${filesScanned} file(s) scanned` +
      (parseErrors.length ? `; ${parseErrors.length} file(s) could not be parsed` : ""),
  );
  return lines.join("\n");
}

async function rpc(url: string, method: string, params: unknown[] = []): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  const body: any = await res.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

export async function status(url: string) {
  const ids = FEATURE_GATES.map((g) => g.id);
  const [accounts, schedRaw, epochInfo] = await Promise.all([
    rpc(url, "getMultipleAccounts", [ids, { encoding: "base64", commitment: "finalized" }]),
    rpc(url, "getEpochSchedule"),
    rpc(url, "getEpochInfo", [{ commitment: "finalized" }]),
  ]);
  const sched: EpochSchedule = {
    slotsPerEpoch: schedRaw.slotsPerEpoch,
    firstNormalEpoch: schedRaw.firstNormalEpoch,
    firstNormalSlot: schedRaw.firstNormalSlot,
  };
  const gates = FEATURE_GATES.map((g, i) => {
    const st = decodeFeatureAccount(accounts.value[i]);
    const row: any = { ...g, ...st };
    if (st.state === "active") {
      const ep = epochOfSlot(st.activatedAt, sched);
      row.activationEpoch = ep;
      if (g.effectiveNextEpoch) {
        row.effectiveEpoch = ep + 1;
        row.effectiveSlot = firstSlotOfEpoch(ep + 1, sched);
        row.inEffect = epochInfo.epoch >= ep + 1;
      } else row.inEffect = true;
    }
    return row;
  });
  return { rpc: url, slot: accounts.context.slot, epoch: epochInfo.epoch, apiVersion: accounts.context.apiVersion, gates };
}

function formatStatus(s: Awaited<ReturnType<typeof status>>): string {
  const out = [`RPC ${s.rpc}  slot ${s.slot}  epoch ${s.epoch}${s.apiVersion ? `  node ${s.apiVersion}` : ""}`, ""];
  for (const g of s.gates) {
    let state: string;
    if (g.state === "active") {
      state = `ACTIVE since slot ${g.activatedAt} (epoch ${g.activationEpoch})`;
      if (g.effectiveNextEpoch) state += g.inEffect ? `, in effect since epoch ${g.effectiveEpoch}` : `, takes effect at epoch ${g.effectiveEpoch} (slot ${g.effectiveSlot})`;
    } else if (g.state === "pending") state = "PENDING (feature account exists, activates at next epoch boundary)";
    else if (g.state === "absent") state = "not scheduled (no feature account)";
    else state = `invalid: ${g.reason}`;
    out.push(`${g.simd.padEnd(12)} ${g.name.padEnd(48)} ${state}${g.note ? `  [${g.note}]` : ""}`);
    out.push(`${"".padEnd(12)} ${g.id}`);
  }
  return out.join("\n");
}

async function main(argv: string[]) {
  const args = parseArgs(argv);
  const cmd = args._[0];
  if (!cmd || args.help || cmd === "help") {
    process.stdout.write(HELP);
    return 0;
  }
  if (args.version) {
    console.log(VERSION);
    return 0;
  }
  if (cmd === "rules") {
    for (const [name, r] of Object.entries(plugin.rules as Record<string, any>)) {
      console.log(`${PLUGIN_NAME}/${name}${r.meta.fixable ? " (autofix)" : ""}${r.meta.hasSuggestions ? " (suggestions)" : ""}\n  ${r.meta.docs.description}\n  ${r.meta.docs.url}`);
    }
    return 0;
  }
  if (cmd === "scan") {
    const target = args._[1] ?? ".";
    if (!existsSync(target)) {
      console.error(`path not found: ${target}`);
      return 2;
    }
    const { findings, filesScanned, parseErrors } = await scan(target, {
      fix: args.fix === true,
      includeTests: args["include-tests"] === true,
      docs: args["no-docs"] !== true,
      ignore: (args.ignore as string[]) ?? [],
    });
    const format = String(args.format ?? "text");
    let body: string;
    if (format === "json") {
      body = JSON.stringify({ tool: "solana-upgrade-check", version: VERSION, target: path.resolve(target), filesScanned, parseErrors, findings }, null, 2);
    } else if (format === "sarif") {
      body = JSON.stringify(toSarif(findings, plugin.rules as any, VERSION), null, 2);
    } else body = formatText(findings, filesScanned, parseErrors);
    if (typeof args.output === "string") writeFileSync(args.output, body + "\n");
    else console.log(body);
    const failOn = String(args["fail-on"] ?? "error");
    if (failOn === "none") return 0;
    if (failOn === "warning" && findings.length) return 1;
    if (findings.some((f) => f.severity === "error")) return 1;
    return 0;
  }
  if (cmd === "status") {
    const url =
      typeof args.rpc === "string" ? args.rpc : CLUSTERS[String(args.cluster ?? "mainnet")] ?? CLUSTERS.mainnet;
    const s = await status(url);
    console.log(args.json ? JSON.stringify(s, null, 2) : formatStatus(s));
    return 0;
  }
  console.error(`unknown command: ${cmd}\n`);
  process.stdout.write(HELP);
  return 2;
}

const invokedDirectly = (() => {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    // exitCode, not exit(): exit() drops stdout that is still buffered for a pipe (> 64 KB reports).
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 2;
    },
  );
}
