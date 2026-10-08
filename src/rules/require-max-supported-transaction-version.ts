import type { Rule } from "eslint";
import {
  docs,
  getObjectProperty,
  hasSpread,
  isSolanaFile,
  propName,
  resolveConstObject,
  type Node,
} from "../util.js";

/**
 * SDK methods (web3.js Connection / Kit Rpc) that return full transactions,
 * mapped to the index of their config argument.
 */
const METHODS: Record<string, number> = {
  getBlock: 1,
  getParsedBlock: 1,
  getTransaction: 1,
  getParsedTransaction: 1,
  getTransactions: 1,
  getParsedTransactions: 1,
  blockNotifications: 1, // Kit rpcSubscriptions.blockNotifications(filter, config)
};

/** Raw JSON-RPC method names: config is params[1]. */
const RAW_METHODS = new Set(["getBlock", "getTransaction", "blockSubscribe"]);

/** Metaplex Umi's RpcInterface sets maxSupportedTransactionVersion itself (umi-rpc-web3js). */
const UMI_IMPORT_RE = /["']@metaplex-foundation\/umi[\w-]*["']/;

function isUmiRpc(callee: Node, sourceText: string): boolean {
  const obj = callee.object;
  if (obj?.type !== "MemberExpression" || propName(obj) !== "rpc") return false;
  return (obj.object.type === "Identifier" && obj.object.name === "umi") || UMI_IMPORT_RE.test(sourceText);
}

/** transactionDetails values for which Agave does not version-check (signatures / none). */
const UNCHECKED_DETAILS = new Set(["signatures", "none"]);

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: docs(
      "Require `maxSupportedTransactionVersion: 1` when reading blocks/transactions (Transaction v1 is live on mainnet since 2026-09-15)",
      "txV1Upgrade",
    ),
    fixable: "code",
    hasSuggestions: true,
    schema: [
      {
        type: "object",
        properties: { requireSolanaImport: { type: "boolean" } },
        additionalProperties: false,
      },
    ],
    messages: {
      missing:
        "`{{method}}` without `maxSupportedTransactionVersion: 1` fails as soon as the response contains a v1 transaction (RPC error -32015; one v1 tx fails the whole getBlock).",
      tooLow:
        "`maxSupportedTransactionVersion: {{value}}` fails on v1 transactions exactly like omitting it. Use the integer 1.",
      notInteger: "`maxSupportedTransactionVersion` must be the JSON integer 1, not the string {{value}}.",
      addConfig: "Add `{ maxSupportedTransactionVersion: 1 }` (check the return type: web3.js switches to the versioned response type).",
      addProperty: "Add `maxSupportedTransactionVersion: 1` to the config object.",
    },
  },
  create(context) {
    const opts = (context.options[0] ?? {}) as { requireSolanaImport?: boolean };
    const requireImport = opts.requireSolanaImport !== false;
    const sourceCode = context.sourceCode;

    function checkConfig(reportNode: Node, method: string, config: Node | undefined, insertAfter: Node | undefined) {
      // 1) no config at all
      if (!config) {
        context.report({
          node: reportNode,
          messageId: "missing",
          data: { method },
          suggest: insertAfter
            ? [
                {
                  messageId: "addConfig",
                  fix: (fixer) => fixer.insertTextAfter(insertAfter, ", { maxSupportedTransactionVersion: 1 }"),
                },
              ]
            : [],
        });
        return;
      }
      // 2) legacy positional commitment string, e.g. getTransaction(sig, "confirmed")
      if (config.type === "Literal" && typeof config.value === "string") {
        context.report({
          node: reportNode,
          messageId: "missing",
          data: { method },
          suggest: [
            {
              messageId: "addConfig",
              fix: (fixer) =>
                fixer.replaceText(
                  config,
                  `{ commitment: ${sourceCode.getText(config)}, maxSupportedTransactionVersion: 1 }`,
                ),
            },
          ],
        });
        return;
      }
      let obj = config;
      let local = true;
      if (config.type === "Identifier") {
        obj = resolveConstObject(context, config);
        local = false;
        if (!obj) return; // unknown at lint time
      }
      if (obj.type !== "ObjectExpression") return;
      const details = getObjectProperty(obj, "transactionDetails");
      if (details?.value?.type === "Literal" && UNCHECKED_DETAILS.has(String(details.value.value))) return;
      const prop = getObjectProperty(obj, "maxSupportedTransactionVersion");
      if (!prop) {
        if (hasSpread(obj)) return; // may come from the spread
        context.report({
          node: reportNode,
          messageId: "missing",
          data: { method },
          suggest: local
            ? [
                {
                  messageId: "addProperty",
                  fix: (fixer) => {
                    if (obj.properties.length === 0) return fixer.replaceText(obj, "{ maxSupportedTransactionVersion: 1 }");
                    const last = obj.properties[obj.properties.length - 1];
                    return fixer.insertTextAfter(last, ", maxSupportedTransactionVersion: 1");
                  },
                },
              ]
            : [],
        });
        return;
      }
      const v = prop.value;
      if (v.type === "Literal") {
        if (typeof v.value === "number" && v.value < 1) {
          context.report({
            node: v,
            messageId: "tooLow",
            data: { value: String(v.value) },
            fix: (fixer) => fixer.replaceText(v, "1"),
          });
        } else if (typeof v.value === "string") {
          const n = Number(v.value);
          context.report({
            node: v,
            messageId: n >= 1 ? "notInteger" : "tooLow",
            data: { value: sourceCode.getText(v) },
            fix: (fixer) => fixer.replaceText(v, "1"),
          });
        }
      }
    }

    return {
      CallExpression(node: Node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;
        const name = propName(callee);
        if (!name || !Object.hasOwn(METHODS, name)) return;
        if (requireImport && !isSolanaFile(context)) return;
        if (isUmiRpc(callee, sourceCode.text)) return;
        const idx = METHODS[name];
        if (node.arguments.length < idx) return; // not our signature
        if (node.arguments.some((a: Node) => a.type === "SpreadElement")) return;
        checkConfig(node, name, node.arguments[idx], node.arguments[idx - 1]);
      },
      ObjectExpression(node: Node) {
        const m = getObjectProperty(node, "method");
        if (!m || m.value.type !== "Literal" || !RAW_METHODS.has(String(m.value.value))) return;
        const params = getObjectProperty(node, "params");
        if (!params || params.value.type !== "ArrayExpression") return;
        const arr = params.value.elements;
        if (arr.length < 1) return;
        checkConfig(m.value, String(m.value.value), arr[1] ?? undefined, arr[0]);
      },
    } as Rule.RuleListener;
  },
};

export default rule;
