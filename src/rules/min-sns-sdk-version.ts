import type { Rule } from "eslint";
import semver from "semver";
import { dependencyVisitor } from "../pkgjson.js";
import { docs } from "../util.js";

/** dev.sns.id migration guide: JS SDK v3 -> v4, JS Kit SDK v0.10 -> v1 (checked 2026-10-08). */
const MINIMUMS: Record<string, string> = {
  "@bonfida/spl-name-service": "4.0.0",
  "@solana-name-service/sns-sdk-kit": "1.0.0",
};

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: docs("Require SNS SDK versions with `.sns` support (package.json)", "snsMigration"),
    schema: [],
    messages: {
      tooOld:
        "{{name}}@\"{{range}}\" predates `.sns` support (need >= {{min}}). SNS-backed `.sol` resolution pauses at slot 452,825,395; upgrade per the SNS migration guide (major upgrade, API renames — not auto-fixed).",
    },
  },
  create(context) {
    return dependencyVisitor(context, (dep) => {
      const min = Object.hasOwn(MINIMUMS, dep.name) ? MINIMUMS[dep.name] : undefined;
      if (!min || !dep.min || semver.gte(dep.min, min)) return;
      context.report({ node: dep.valueNode, messageId: "tooOld", data: { name: dep.name, range: dep.range, min } });
    });
  },
};

export default rule;
