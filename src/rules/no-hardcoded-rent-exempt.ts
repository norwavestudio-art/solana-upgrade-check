import type { Rule } from "eslint";
import { boundName, docs, numericValue, propName, type Node } from "../util.js";

/** SIMD-0437 schedule plus the pre-SIMD-0194 per-byte-year value. */
const LEGACY_LPB = 6960;
const STEP_LPB = [6333, 5080, 2575, 1322, 696];
const PER_BYTE_VALUES = new Set([LEGACY_LPB, 3480, ...STEP_LPB]);
const OVERHEAD = 128; // ACCOUNT_STORAGE_OVERHEAD
const MAX_DATA = 10 * 1024 * 1024;
/** Well-known account sizes: empty, nonce, mint, token account, stake. */
const KNOWN_SIZES = [0, 80, 82, 165, 200];
const KNOWN_STEP_VALUES = new Map<number, string>();
for (const lpb of STEP_LPB) for (const s of KNOWN_SIZES) KNOWN_STEP_VALUES.set((OVERHEAD + s) * lpb, `${s} bytes at ${lpb} lamports/byte`);

const NAME_HINT = /rent|lamports?_?per_?byte|per_?byte|exempt/i;
const SIZE_HINT = /size|len|length|bytes?|space/i;

function describeLegacy(n: number): string | undefined {
  if (n < OVERHEAD * LEGACY_LPB || n % LEGACY_LPB !== 0 || n % 10000 === 0) return undefined;
  const data = n / LEGACY_LPB - OVERHEAD;
  if (data > MAX_DATA) return undefined;
  return `${data} bytes at the legacy 6960 lamports/byte`;
}

function mentionsSize(node: Node, sourceCode: any): boolean {
  return SIZE_HINT.test(sourceCode.getText(node)) || /\b128\b/.test(sourceCode.getText(node));
}

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: docs(
      "Disallow hard-coded rent-exempt minimums / lamports-per-byte constants; rent is being cut in 5 feature-gated steps (SIMD-0437)",
      "simd0437",
    ),
    schema: [],
    messages: {
      exemptAmount:
        "{{value}} looks like a hard-coded rent-exempt minimum ({{desc}}). lamports_per_byte changes with each SIMD-0437 step (6960 -> 6333 -> 5080 -> 2575 -> 1322 -> 696). Use getMinimumBalanceForRentExemption(size) or the Rent sysvar.",
      perByte:
        "{{value}} looks like a hard-coded lamports-per-byte rent constant. It changes with each SIMD-0437 step; read it from getMinimumBalanceForRentExemption or the Rent sysvar.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      Literal(node: Node) {
        const n = numericValue(node);
        if (n === undefined || !Number.isInteger(n)) return;
        const desc = describeLegacy(n) ?? KNOWN_STEP_VALUES.get(n);
        if (desc) {
          context.report({ node, messageId: "exemptAmount", data: { value: sourceCode.getText(node), desc } });
          return;
        }
        if (!PER_BYTE_VALUES.has(n)) return;
        const name = boundName(node);
        let hit = !!(name && NAME_HINT.test(name));
        const p = node.parent;
        if (!hit && p?.type === "BinaryExpression" && p.operator === "*") {
          const other = p.left === node ? p.right : p.left;
          hit = mentionsSize(other, sourceCode) || NAME_HINT.test(boundName(p) ?? "");
        }
        if (!hit && p?.type === "CallExpression" && /rent/i.test(propName(p.callee) ?? "")) hit = true;
        if (hit) context.report({ node, messageId: "perByte", data: { value: sourceCode.getText(node) } });
      },
    } as Rule.RuleListener;
  },
};

export default rule;
