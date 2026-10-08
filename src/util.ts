import type { Rule } from "eslint";
import { SOURCES, type SourceKey } from "./sources.js";

export type RuleModule = Rule.RuleModule;
export type Node = any;

export function docs(description: string, source: SourceKey, recommended = true) {
  return { description, url: SOURCES[source].url, recommended };
}

const SOLANA_IMPORT_RE =
  /(?:from\s*|require\(\s*|import\(\s*|import\s+)["'](?:@solana\/|@solana-program\/|@coral-xyz\/anchor|@project-serum\/anchor|@bonfida\/|@solana-name-service\/|@metaplex-foundation\/|@triton-one\/)/;

/** True when the file imports a Solana SDK package (cheap text check). */
export function isSolanaFile(context: Rule.RuleContext): boolean {
  return SOLANA_IMPORT_RE.test(context.sourceCode.text);
}

const SNS_IMPORT_RE =
  /(?:from\s*|require\(\s*|import\(\s*|import\s+)["'](?:@bonfida\/spl-name-service|@bonfida\/sns-react|@solana-name-service\/)/;

export function isSnsFile(context: Rule.RuleContext): boolean {
  return SNS_IMPORT_RE.test(context.sourceCode.text);
}

/** Name of a callee / member property / identifier, if static. */
export function propName(node: Node): string | undefined {
  if (!node) return undefined;
  if (node.type === "Identifier") return node.name;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "MemberExpression") {
    if (!node.computed) return node.property.name;
    if (node.property.type === "Literal") return String(node.property.value);
  }
  return undefined;
}

/** Variable / property name a value is bound to (for name-based heuristics). */
export function boundName(node: Node): string | undefined {
  let cur = node;
  // climb through trivial wrappers
  while (
    cur.parent &&
    ["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression", "UnaryExpression", "ChainExpression"].includes(
      cur.parent.type,
    )
  ) {
    cur = cur.parent;
  }
  const p = cur.parent;
  if (!p) return undefined;
  if (p.type === "VariableDeclarator" && p.init === cur) return propName(p.id);
  if ((p.type === "Property" || p.type === "PropertyDefinition") && p.value === cur) return propName(p.key);
  if (p.type === "AssignmentExpression" && p.right === cur) return propName(p.left);
  if (p.type === "AssignmentPattern" && p.right === cur) return propName(p.left);
  return undefined;
}

export function getObjectProperty(obj: Node, name: string): Node | undefined {
  if (!obj || obj.type !== "ObjectExpression") return undefined;
  for (const p of obj.properties) {
    if (p.type === "Property" && propName(p.key) === name) return p;
  }
  return undefined;
}

export function hasSpread(obj: Node): boolean {
  return obj?.type === "ObjectExpression" && obj.properties.some((p: Node) => p.type === "SpreadElement");
}

/** Resolve `const x = { ... }` declared in an enclosing scope. */
export function resolveConstObject(context: Rule.RuleContext, id: Node): Node | undefined {
  if (id?.type !== "Identifier") return undefined;
  let scope: any = context.sourceCode.getScope(id);
  while (scope) {
    const v = scope.set.get(id.name);
    if (v) {
      const def = v.defs[0];
      if (
        def &&
        def.type === "Variable" &&
        def.parent?.kind === "const" &&
        def.node.init?.type === "ObjectExpression" &&
        v.references.every((r: any) => !r.isWrite() || r.init)
      ) {
        return def.node.init;
      }
      return undefined;
    }
    scope = scope.upper;
  }
  return undefined;
}

/** Numeric value of a number / bigint literal (with `_` separators). */
export function numericValue(node: Node): number | undefined {
  if (node?.type !== "Literal") return undefined;
  if (typeof node.value === "number") return node.value;
  if (typeof node.bigint === "string") return Number(node.bigint);
  return undefined;
}
