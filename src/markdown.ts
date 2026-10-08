import type { Linter } from "eslint";

/**
 * ESLint processor for Markdown / MDX docs.
 *
 * - Fenced JS/TS blocks are linted as-is.
 * - Fenced JSON blocks and JSON-RPC bodies in curl commands (`-d '...'`, `--data '...'`)
 *   are linted as JS expressions, so raw `getBlock` / `getTransaction` requests are checked too.
 *
 * Each block is an exact slice of the document, so positions and fixes map back by offset.
 * Docs often contain partial snippets; their parse errors are dropped.
 */

const JS_LANGS: Record<string, string> = {
  js: "js",
  javascript: "js",
  mjs: "js",
  cjs: "js",
  jsx: "jsx",
  ts: "ts",
  typescript: "ts",
  mts: "ts",
  cts: "ts",
  tsx: "tsx",
};
const JSON_LANGS = new Set(["json", "jsonc", "json5"]);
const SHELL_LANGS = new Set(["sh", "bash", "shell", "zsh", "console", "terminal", "curl"]);

/** Appended to blocks of a document that is about Solana; see `isSolanaFile`. */
export const SOLANA_CONTEXT_MARKER = "/* solana-upgrade-check: solana-context */";

interface Block {
  text: string;
  ext: string;
  offset: number; // offset of text[0] in the document
  json?: boolean;
}

const FENCE_RE = /^([ \t]*)(`{3,}|~{3,})[ \t]*([^\s`{]*)[^\n]*$/;

export function extractBlocks(doc: string): Block[] {
  const blocks: Block[] = [];
  const lines = doc.split("\n");
  let pos = 0;
  let open: { fence: string; lang: string; start: number } | undefined;
  for (const line of lines) {
    const lineStart = pos;
    pos += line.length + 1;
    const m = FENCE_RE.exec(line.replace(/\r$/, ""));
    if (!open) {
      if (m) open = { fence: m[2], lang: m[3].toLowerCase(), start: pos };
      continue;
    }
    if (!m || m[3] !== "" || m[2][0] !== open.fence[0] || m[2].length < open.fence.length) continue;
    const body = doc.slice(open.start, lineStart);
    const lang = open.lang.replace(/^language-/, "");
    open = undefined;
    if (Object.hasOwn(JS_LANGS, lang)) {
      blocks.push({ text: body, ext: JS_LANGS[lang], offset: lineStart - body.length });
    } else if (JSON_LANGS.has(lang)) {
      if (/"method"\s*:/.test(body)) blocks.push(wrapJson(body, lineStart - body.length));
    } else if (SHELL_LANGS.has(lang)) {
      const base = lineStart - body.length;
      for (const d of curlBodies(body)) blocks.push(wrapJson(d.text, base + d.offset));
    }
  }
  return blocks;
}

/** JSON is a valid JS expression once parenthesised; the offset counts the added `(`. */
function wrapJson(text: string, offset: number): Block {
  return { text: `(${text})`, ext: "js", offset: offset - 1, json: true };
}

/** Single-quoted JSON-RPC bodies passed to curl. */
function curlBodies(sh: string): { text: string; offset: number }[] {
  const out: { text: string; offset: number }[] = [];
  const re = /(?:^|\s)(?:-d|--data(?:-raw|-binary)?)[ \t]+'(\s*)(\{[^']*\})\s*'/g;
  for (let m; (m = re.exec(sh)); ) {
    if (!/"method"\s*:/.test(m[2])) continue;
    out.push({ text: m[2], offset: m.index + m[0].indexOf("'") + 1 + m[1].length });
  }
  return out;
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  return starts;
}

function toLineCol(starts: number[], offset: number): { line: number; column: number } {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: offset - starts[lo] + 1 };
}

const SOLANA_DOC_RE = /\bsolana\b/i;

export function createMarkdownProcessor(): Linter.Processor {
  // ESLint calls preprocess, lints the blocks and calls postprocess synchronously per file.
  let current: { blocks: Block[]; starts: number[] } = { blocks: [], starts: [0] };
  return {
    meta: { name: "solana-upgrade/markdown" },
    supportsAutofix: true,
    preprocess(text: string) {
      const blocks = extractBlocks(text);
      current = { blocks, starts: lineStarts(text) };
      const solana = SOLANA_DOC_RE.test(text);
      return blocks.map((b, i) => ({
        filename: `${i}.${b.ext}`,
        // The marker goes after the code, so it shifts no positions.
        text: b.text + (solana ? `\n${SOLANA_CONTEXT_MARKER}\n` : "\n"),
      }));
    },
    postprocess(messageLists: Linter.LintMessage[][]) {
      const { blocks, starts } = current;
      const out: Linter.LintMessage[] = [];
      messageLists.forEach((messages, i) => {
        const b = blocks[i];
        if (!b) return;
        const bStarts = lineStarts(b.text);
        const map = (line: number, column: number) => {
          const off = (bStarts[line - 1] ?? 0) + column - 1;
          return toLineCol(starts, b.offset + off);
        };
        for (const m of messages) {
          if (m.fatal || !m.ruleId) continue; // partial snippets do not parse; that is expected
          // JSON blocks are often response samples; only the request rule applies to them.
          if (b.json && !m.ruleId.endsWith("/require-max-supported-transaction-version")) continue;
          const start = map(m.line, m.column);
          const msg: Linter.LintMessage = { ...m, line: start.line, column: start.column };
          if (m.endLine !== undefined && m.endColumn !== undefined) {
            const end = map(m.endLine, m.endColumn);
            msg.endLine = end.line;
            msg.endColumn = end.column;
          }
          const shift = (f: { range: [number, number]; text: string }) => ({
            range: [f.range[0] + b.offset, f.range[1] + b.offset] as [number, number],
            text: f.text,
          });
          if (m.fix) msg.fix = shift(m.fix);
          // Suggestions insert JS syntax, which would not be valid JSON.
          if (m.suggestions && !b.json) msg.suggestions = m.suggestions.map((s) => ({ ...s, fix: shift(s.fix) }));
          else delete msg.suggestions;
          out.push(msg);
        }
      });
      return out;
    },
  };
}
