import type { Rule } from "eslint";
import { boundName, docs, numericValue, type Node } from "../util.js";

/** Names that clearly denote "time per slot" / "slots per second" / "ticks per second". */
const SLOT_TIME_NAME =
  /^(?:default_?)?(?:ms|millis(?:econds)?|seconds?|secs?)_?per_?slot$|slot_?(?:duration|time|interval|length|period)(?:_?(?:ms|millis|seconds?|secs?|s))?$|^(?:avg|average|approx|estimated|est|target|default)?_?(?:ms|millis|seconds?|secs?)_?(?:per|each)_?slot|slots?_?per_?(?:second|sec|s)$|ticks?_?per_?(?:second|sec)$/i;

/** Literal values that encode the 400ms assumption, in the units we expect. */
const SLOT_VALUES = new Map<number, string>([
  [400, "400 ms per slot"],
  [0.4, "0.4 s per slot"],
  [2.5, "2.5 slots per second"],
  [160, "160 ticks per second"],
]);

const IDENTIFIERS = new Set(["MS_PER_SLOT", "DEFAULT_MS_PER_SLOT", "NUM_SLOTS_PER_SECOND", "NUM_TICKS_PER_SECOND", "DEFAULT_S_PER_SLOT"]);

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: docs(
      "Disallow the 400ms-per-slot assumption when converting slots to wall-clock time (SIMD-0525: 400 -> 350 -> 300 -> 250 -> 200 ms)",
      "simd0525",
    ),
    schema: [],
    messages: {
      literal:
        "{{value}} encodes {{what}}. Mainnet slots are now 250ms and move to 200ms (SIMD-0525); slot-to-time conversions drift. Use getBlockTime / getRecentPerformanceSamples, or measure the current slot duration.",
      identifier:
        "`{{name}}` is a static slot-time constant; SIMD-0525 says static SDK constants disagree with chain reality. Derive slot duration from the cluster instead.",
    },
  },
  create(context) {
    const sc = context.sourceCode;
    return {
      Literal(node: Node) {
        const n = numericValue(node);
        if (n === undefined) return;
        const what = SLOT_VALUES.get(n);
        if (!what) return;
        const name = boundName(node);
        let hit = !!(name && SLOT_TIME_NAME.test(name));
        const p = node.parent;
        if (!hit && n !== 160 && p?.type === "BinaryExpression" && (p.operator === "*" || p.operator === "/")) {
          const other = p.left === node ? p.right : p.left;
          const outer = boundName(p) ?? "";
          hit = /slot/i.test(sc.getText(other)) || /slot/i.test(outer);
        }
        if (hit) context.report({ node, messageId: "literal", data: { value: sc.getText(node), what } });
      },
      ImportSpecifier(node: Node) {
        const imported = node.imported?.name ?? node.imported?.value;
        if (IDENTIFIERS.has(imported)) context.report({ node, messageId: "identifier", data: { name: imported } });
      },
    } as Rule.RuleListener;
  },
};

export default rule;
