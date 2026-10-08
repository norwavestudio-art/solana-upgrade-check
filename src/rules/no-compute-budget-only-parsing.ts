import type { Rule } from "eslint";
import { docs, propName, type Node } from "../util.js";

const CB_ID_RE = /^ComputeBudget1{20,}$/;
const DECODE_FNS = new Set([
  // @solana-program/compute-budget (Kit clients)
  "identifyComputeBudgetInstruction",
  "parseSetComputeUnitPriceInstruction",
  "parseSetComputeUnitLimitInstruction",
  "parseRequestHeapFrameInstruction",
  "parseSetLoadedAccountsDataSizeLimitInstruction",
  // @solana/web3.js 1.x ComputeBudgetInstruction static decoders
  "decodeSetComputeUnitPrice",
  "decodeSetComputeUnitLimit",
  "decodeRequestHeapFrame",
  "decodeRequestUnits",
]);

const READ_INDICATORS =
  /\b(?:getTransaction|getParsedTransaction|getTransactions|getParsedTransactions|getBlock|getParsedBlock|blockNotifications|blockSubscribe|SubscribeUpdateTransaction|SubscribeUpdateBlock)\b/;

function isComputeBudgetId(node: Node): boolean {
  if (!node) return false;
  if (node.type === "Literal" && typeof node.value === "string") return CB_ID_RE.test(node.value);
  if (node.type === "Identifier") return node.name === "COMPUTE_BUDGET_PROGRAM_ADDRESS";
  if (node.type === "MemberExpression") {
    // ComputeBudgetProgram.programId
    if (propName(node) === "programId" && node.object.type === "Identifier" && node.object.name === "ComputeBudgetProgram")
      return true;
  }
  if (node.type === "CallExpression" && node.callee.type === "MemberExpression") {
    // ComputeBudgetProgram.programId.toBase58() / .toString()
    const n = propName(node.callee);
    if ((n === "toBase58" || n === "toString") && isComputeBudgetId(node.callee.object)) return true;
  }
  return false;
}

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: docs(
      "Flag code that reads transactions from the chain and inspects ComputeBudget instructions without a Transaction v1 `transactionConfig` branch",
      "txV1Upgrade",
    ),
    schema: [],
    messages: {
      cbOnly:
        "This file fetches transactions and inspects ComputeBudget instructions, but never reads `transactionConfig`. For v1 transactions these values live in `message.transactionConfig` and scanning reports zero without erroring (v1 priority fee is a total in lamports, not micro-lamports/CU).",
    },
  },
  create(context) {
    let reported = false;
    const text = context.sourceCode.text;
    // Only files that read transactions from the chain: sender-side code that filters
    // ComputeBudget instructions while *building* a transaction is not affected by v1.
    const readsChain = READ_INDICATORS.test(text);
    const mentionsConfig = /transactionConfig/.test(text) || !readsChain;
    function report(node: Node) {
      if (reported || mentionsConfig) return;
      reported = true;
      context.report({ node, messageId: "cbOnly" });
    }
    return {
      BinaryExpression(node: Node) {
        if (!["===", "==", "!==", "!="].includes(node.operator)) return;
        if (isComputeBudgetId(node.left) || isComputeBudgetId(node.right)) report(node);
      },
      CallExpression(node: Node) {
        const callee = node.callee;
        const name = propName(callee);
        if (!name) return;
        if (DECODE_FNS.has(name)) return report(node);
        if (name === "equals" && callee.type === "MemberExpression") {
          if (isComputeBudgetId(callee.object) || node.arguments.some(isComputeBudgetId)) report(node);
        }
      },
      SwitchCase(node: Node) {
        if (node.test && isComputeBudgetId(node.test)) report(node);
      },
    } as Rule.RuleListener;
  },
};

export default rule;
