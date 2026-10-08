import type { Rule } from "eslint";
import semver from "semver";
import type { Node } from "./util.js";

const DEP_FIELDS = new Set(["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]);

export interface DepEntry {
  name: string;
  range: string;
  field: string;
  valueNode: Node;
  min: semver.SemVer | null;
}

function keyName(key: Node): string | undefined {
  if (key.type === "JSONLiteral") return String(key.value);
  if (key.type === "JSONIdentifier") return key.name;
  return undefined;
}

/** Visitor for package.json dependency entries (jsonc-eslint-parser AST). */
export function dependencyVisitor(
  context: Rule.RuleContext,
  onDep: (dep: DepEntry) => void,
  fields: Set<string> = DEP_FIELDS,
): Rule.RuleListener {
  const filename = context.filename.replace(/\\/g, "/");
  if (!filename.endsWith("package.json")) return {};
  return {
    JSONProperty(node: Node) {
      const obj = node.parent; // JSONObjectExpression (deps map)
      const fieldProp = obj?.parent; // JSONProperty ("dependencies": {...})
      if (fieldProp?.type !== "JSONProperty") return;
      const root = fieldProp.parent;
      if (root?.parent?.type !== "JSONExpressionStatement") return;
      const field = keyName(fieldProp.key);
      if (!field || !fields.has(field)) return;
      const name = keyName(node.key);
      if (!name || node.value.type !== "JSONLiteral" || typeof node.value.value !== "string") return;
      const range = node.value.value;
      let min: semver.SemVer | null = null;
      try {
        min = semver.validRange(range) ? semver.minVersion(range) : null;
      } catch {
        min = null;
      }
      onDep({ name, range, field, valueNode: node.value, min });
    },
  } as Rule.RuleListener;
}

/**
 * Same-major bump of a simple range (`1.2.3`, `^1.2.3`, `~1.2.3`) to `target`.
 * Returns undefined when the bump would cross a major or the range is complex.
 */
export function sameMajorBump(range: string, target: string): string | undefined {
  const m = /^\s*([~^]?)(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?\s*$/.exec(range);
  if (!m) return undefined;
  const t = semver.parse(target);
  if (!t || Number(m[2]) !== t.major || t.major === 0) return undefined;
  return `${m[1]}${target}`;
}
