import type { Rule } from "eslint";
import { boundName, docs, numericValue, propName, type Node } from "../util.js";

const BLOCKHASH = /blockhash/i;
const TIME_WORD = /ttl|timeout|expir|valid|lifetime|life|max_?age|_ms$|ms$|millis|seconds?|secs?|duration|window|deadline|refresh|stale/i;
const COUNT_WORD = /slots?|blocks?_?(?:count|height|num)|height|count/i;
const SECONDS_NAME = /sec(?:ond)?s?(?:_|$)|_s$|Secs?$/i;
const TIMER_FNS = new Set(["setTimeout", "setInterval", "sleep", "delay", "wait"]);

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: docs(
      "Disallow wall-clock blockhash lifetimes (e.g. 60s/90s). The window is 150 blocks, which is ~50s at 250ms slots and ~40s at 200ms (SIMD-0525)",
      "reducedSlots",
    ),
    schema: [],
    messages: {
      wallclock:
        "{{value}} hard-codes a wall-clock blockhash lifetime. Blockhash expiry is counted in blocks (150), so it now passes in ~50s (250ms slots) and ~40s at 200ms. Use lastValidBlockHeight from getLatestBlockhash and compare with getBlockHeight.",
    },
  },
  create(context) {
    const sc = context.sourceCode;
    function inBlockhashFunction(node: Node): boolean {
      let cur = node.parent;
      while (cur) {
        if (cur.type === "FunctionDeclaration" || cur.type === "FunctionExpression" || cur.type === "ArrowFunctionExpression") {
          return BLOCKHASH.test(sc.getText(cur));
        }
        cur = cur.parent;
      }
      return false;
    }
    return {
      Literal(node: Node) {
        const n = numericValue(node);
        if (n === undefined) return;
        const name = boundName(node);
        if (name && BLOCKHASH.test(name) && TIME_WORD.test(name) && !COUNT_WORD.test(name)) {
          const isMs = n >= 20_000 && n <= 150_000;
          const isSec = SECONDS_NAME.test(name) && n >= 20 && n <= 150;
          if (isMs || isSec) {
            context.report({ node, messageId: "wallclock", data: { value: sc.getText(node) } });
          }
          return;
        }
        // setTimeout(refreshBlockhash, 60_000) and friends inside blockhash-handling code
        const p = node.parent;
        if (
          p?.type === "CallExpression" &&
          p.arguments.includes(node) &&
          TIMER_FNS.has(propName(p.callee) ?? "") &&
          [60_000, 80_000, 90_000].includes(n) &&
          inBlockhashFunction(node)
        ) {
          context.report({ node, messageId: "wallclock", data: { value: sc.getText(node) } });
        }
      },
    } as Rule.RuleListener;
  },
};

export default rule;
