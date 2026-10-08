import type { Rule } from "eslint";
import { docs, isSnsFile, propName, type Node } from "../util.js";

const DOMAINISH = /domain|reverse|\bsns\b|primary|favou?rite/i;
const SUFFIX_AT_START = /^\.sol(?![A-Za-z0-9_])/;
const LITERAL_DOMAIN = /^[a-z0-9][a-z0-9_-]*(?:\.[a-z0-9_-]+)*\.sol$/;
const CHECK_METHODS = new Set(["endsWith", "replace", "replaceAll", "includes", "indexOf", "lastIndexOf", "slice"]);

const rule: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: docs(
      "Disallow hard-coded `.sol` suffixes for SNS names: existing SNS domains are now `.sns`, and `.sol` resolution is paused in the official SDKs at slot 452,825,395",
      "snsMigration",
    ),
    fixable: "code",
    hasSuggestions: true,
    schema: [],
    messages: {
      suffix:
        "Hard-coded `.sol` suffix for an SNS domain. Per the SNS migration guide, display existing SNS domains with `.sns` (`.sol` resolution is paused in official SDKs since slot 452,825,395).",
      literal:
        "SNS name literal `{{value}}` uses `.sol`. Existing SPL Name Service domains resolve as `.sns` now; `.sol` will later refer to the separate SRS registry.",
      check:
        "Suffix check on `.sol` only. Existing SNS domains are `.sns` now and new `.sol` names live in a different registry (SRS); handle both explicitly.",
      toSns: "Replace `.sol` with `.sns`.",
    },
  },
  create(context) {
    const sc = context.sourceCode;
    const sns = isSnsFile(context);

    function reportReplace(node: Node, messageId: "suffix" | "literal", range: [number, number], data?: Record<string, string>) {
      const fix = (fixer: Rule.RuleFixer) => fixer.replaceTextRange(range, ".sns");
      context.report(
        sns
          ? { node, messageId, data, fix }
          : { node, messageId, data, suggest: [{ messageId: "toSns", fix }] },
      );
    }

    return {
      TemplateLiteral(node: Node) {
        if (node.parent?.type === "TaggedTemplateExpression") return;
        for (let i = 1; i < node.quasis.length; i++) {
          const q = node.quasis[i];
          if (!SUFFIX_AT_START.test(q.value.raw)) continue;
          const expr = node.expressions[i - 1];
          if (!sns && !DOMAINISH.test(sc.getText(expr))) continue;
          // quasi range starts at "}" ; ".sol" begins right after it
          const start = q.range[0] + 1;
          reportReplace(q, "suffix", [start, start + 4]);
        }
      },
      BinaryExpression(node: Node) {
        if (node.operator !== "+") return;
        const r = node.right;
        if (r.type !== "Literal" || typeof r.value !== "string" || !SUFFIX_AT_START.test(r.value)) return;
        if (!sns && !DOMAINISH.test(sc.getText(node.left))) return;
        const start = r.range[0] + 1; // skip opening quote
        reportReplace(r, "suffix", [start, start + 4]);
      },
      Literal(node: Node) {
        if (typeof node.value === "string" && LITERAL_DOMAIN.test(node.value)) {
          const p = node.parent;
          const inCall = p?.type === "CallExpression" && /resolve|domain|record|sns/i.test(propName(p.callee) ?? "");
          if (!sns && !inCall) return;
          if (p?.type === "ImportDeclaration" || p?.type === "ExportAllDeclaration") return;
          // Suggestion only: low-level helpers (getHashedName, getDomainKeySync...) need TLD-less
          // input, so a blanket ".sol" -> ".sns" rewrite of a literal is not always safe.
          const end = node.range[1] - 1; // before closing quote
          context.report({
            node,
            messageId: "literal",
            data: { value: node.value },
            suggest: [{ messageId: "toSns", fix: (fixer) => fixer.replaceTextRange([end - 4, end], ".sns") }],
          });
          return;
        }
        // .endsWith(".sol") / .replace(".sol", "") / /\.sol$/
        const isSolStr = typeof node.value === "string" && node.value === ".sol";
        const isSolRe = node.regex && /\\\.sol(?![A-Za-z])/.test(node.regex.pattern);
        if (!isSolStr && !isSolRe) return;
        const p = node.parent;
        if (p?.type === "CallExpression" && p.arguments[0] === node && p.callee.type === "MemberExpression") {
          const m = propName(p.callee) ?? "";
          if (!CHECK_METHODS.has(m) && !(isSolRe && (m === "test" || m === "match" || m === "exec"))) return;
          if (!sns && !DOMAINISH.test(sc.getText(p.callee.object))) return;
          context.report({ node, messageId: "check" });
        } else if (isSolRe && p?.type === "MemberExpression" && p.object === node && p.parent?.type === "CallExpression") {
          // /\.sol$/.test(domain)
          const arg = p.parent.arguments[0];
          if (!sns && !(arg && DOMAINISH.test(sc.getText(arg)))) return;
          context.report({ node, messageId: "check" });
        }
      },
    } as Rule.RuleListener;
  },
};

export default rule;
