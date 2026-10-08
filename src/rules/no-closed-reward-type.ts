import type { Rule } from "eslint";
import { docs, propName, type Node } from "../util.js";

const LEGACY = new Set(["Fee", "Rent", "Staking", "Voting"]);
const NEW_VALUES = ["DeactivatedStake", "VATDebit"];

function stringLit(node: Node): string | undefined {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  if (node?.type === "TSLiteralType") return stringLit(node.literal);
  return undefined;
}

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: docs(
      "Disallow closed handling of `rewardType` (Fee/Rent/Staking/Voting only): `DeactivatedStake` and `VATDebit` were added to RewardType",
      "rewardInfo",
    ),
    hasSuggestions: true,
    schema: [],
    messages: {
      closedSwitch:
        "switch on `rewardType` only handles {{cases}} and has no default. RewardType now also has DeactivatedStake and VATDebit (negative lamports); treat it as an open set.",
      closedUnion:
        "Closed `rewardType` union ({{cases}}). RewardType now also includes DeactivatedStake and VATDebit; add them or widen the type.",
      closedEnum:
        "enum `{{name}}` mirrors RewardType without DeactivatedStake / VATDebit; responses containing them will not map.",
      addDefault: "Add a default branch.",
      addMembers: "Add \"DeactivatedStake\" | \"VATDebit\".",
    },
  },
  create(context) {
    const sc = context.sourceCode;
    return {
      SwitchStatement(node: Node) {
        if (propName(node.discriminant) !== "rewardType") return;
        if (node.cases.some((c: Node) => c.test === null)) return;
        const vals = node.cases.map((c: Node) => stringLit(c.test));
        if (vals.some((v: string | undefined) => v === undefined || !LEGACY.has(v))) return;
        const closeBrace = sc.getLastToken(node);
        context.report({
          node: node.discriminant,
          messageId: "closedSwitch",
          data: { cases: vals.join("/") },
          suggest: closeBrace
            ? [
                {
                  messageId: "addDefault",
                  fix: (fixer) =>
                    fixer.insertTextBefore(closeBrace, "  default:\n    // DeactivatedStake, VATDebit and future reward types\n    break;\n"),
                },
              ]
            : [],
        });
      },
      TSUnionType(node: Node) {
        const vals = node.types
          .filter((t: Node) => t.type !== "TSNullKeyword" && t.type !== "TSUndefinedKeyword")
          .map(stringLit);
        if (vals.length < 3 || vals.some((v: string | undefined) => v === undefined || !LEGACY.has(v))) return;
        context.report({
          node,
          messageId: "closedUnion",
          data: { cases: vals.join("/") },
          suggest: [
            {
              messageId: "addMembers",
              fix: (fixer) => fixer.insertTextAfter(node, NEW_VALUES.map((v) => ` | "${v}"`).join("")),
            },
          ],
        });
      },
      TSEnumDeclaration(node: Node) {
        if (!/rewardtype/i.test(node.id.name)) return;
        const members = (node.body?.members ?? node.members ?? []).map((m: Node) => propName(m.id));
        if (members.length < 3 || !members.every((m: string) => LEGACY.has(m.charAt(0).toUpperCase() + m.slice(1).toLowerCase()))) return;
        context.report({ node: node.id, messageId: "closedEnum", data: { name: node.id.name } });
      },
    } as Rule.RuleListener;
  },
};

export default rule;
