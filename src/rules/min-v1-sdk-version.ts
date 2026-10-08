import type { Rule } from "eslint";
import semver from "semver";
import { dependencyVisitor, sameMajorBump } from "../pkgjson.js";
import { docs } from "../util.js";

/**
 * "First stable releases that handle v1 transactions" — table on
 * https://solana.com/upgrades/larger-transaction-sizes (checked 2026-10-08).
 * Keyed by package, then by major version line.
 */
const MINIMUMS: Record<string, { min: Record<number, string | null>; note: string }> = {
  "@solana/kit": { min: { 0: "8.0.0", 1: "8.0.0", 2: "8.0.0", 3: "8.0.0", 4: "8.0.0", 5: "8.0.0", 6: "8.0.0", 7: "8.0.0" }, note: "read and send v1" },
  "@solana/web3.js": {
    // 2.x is the pre-rename Kit line and never got v1 support.
    min: { 0: "1.99.0", 1: "1.99.0", 2: null, 3: "3.0.2" },
    note: "1.99.0 reads v1 (cannot build/send); 3.0.2 reads and sends",
  },
  "@solana/wallet-standard-features": { min: { 0: "1.5.0", 1: "1.5.0" }, note: "lets a wallet advertise v1 in supportedTransactionVersions" },
  "@triton-one/yellowstone-grpc": { min: { 0: "6.0.0", 1: "6.0.0", 2: "6.0.0", 3: "6.0.0", 4: "6.0.0", 5: "6.0.0" }, note: "decodes Message.config (field 7)" },
};

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: docs("Require SDK versions that can decode Transaction v1 (package.json)", "txV1Upgrade"),
    fixable: "code",
    schema: [{ type: "object", properties: { includePeer: { type: "boolean" } }, additionalProperties: false }],
    messages: {
      tooOld:
        "{{name}}@\"{{range}}\" allows versions without Transaction v1 support (minimum: {{min}} — {{note}}).",
      noSupport:
        "{{name}}@\"{{range}}\": the 2.x line has no Transaction v1 support. Move to @solana/kit >= 8.0.0 or @solana/web3.js >= 3.0.2.",
    },
  },
  create(context) {
    const includePeer = (context.options[0] as any)?.includePeer === true;
    const fields = new Set(["dependencies", "devDependencies", "optionalDependencies", ...(includePeer ? ["peerDependencies"] : [])]);
    return dependencyVisitor(
      context,
      (dep) => {
        const spec = Object.hasOwn(MINIMUMS, dep.name) ? MINIMUMS[dep.name] : undefined;
        if (!spec || !dep.min) return;
        const major = dep.min.major;
        if (!(major in spec.min)) return; // newer major than we know about
        const min = spec.min[major];
        if (min === null) {
          context.report({ node: dep.valueNode, messageId: "noSupport", data: { name: dep.name, range: dep.range } });
          return;
        }
        if (semver.gte(dep.min, min)) return;
        const bumped = sameMajorBump(dep.range, min);
        context.report({
          node: dep.valueNode,
          messageId: "tooOld",
          data: { name: dep.name, range: dep.range, min, note: spec.note },
          fix: bumped ? (fixer) => fixer.replaceText(dep.valueNode, JSON.stringify(bumped)) : null,
        });
      },
      fields,
    );
  },
};

export default rule;
