import type { ESLint, Linter } from "eslint";
import tsParser from "@typescript-eslint/parser";
import * as jsoncParser from "jsonc-eslint-parser";
import requireMaxSupportedTransactionVersion from "./rules/require-max-supported-transaction-version.js";
import noComputeBudgetOnlyParsing from "./rules/no-compute-budget-only-parsing.js";
import noHardcodedRentExempt from "./rules/no-hardcoded-rent-exempt.js";
import noHardcodedSlotDuration from "./rules/no-hardcoded-slot-duration.js";
import noWallclockBlockhashExpiry from "./rules/no-wallclock-blockhash-expiry.js";
import noHardcodedSolSuffix from "./rules/no-hardcoded-sol-suffix.js";
import noLegacySnsApi from "./rules/no-legacy-sns-api.js";
import noClosedRewardType from "./rules/no-closed-reward-type.js";
import minV1SdkVersion from "./rules/min-v1-sdk-version.js";
import minSnsSdkVersion from "./rules/min-sns-sdk-version.js";
import { createMarkdownProcessor } from "./markdown.js";

export const PLUGIN_NAME = "solana-upgrade";

export const rules = {
  "require-max-supported-transaction-version": requireMaxSupportedTransactionVersion,
  "no-compute-budget-only-parsing": noComputeBudgetOnlyParsing,
  "no-hardcoded-rent-exempt": noHardcodedRentExempt,
  "no-hardcoded-slot-duration": noHardcodedSlotDuration,
  "no-wallclock-blockhash-expiry": noWallclockBlockhashExpiry,
  "no-hardcoded-sol-suffix": noHardcodedSolSuffix,
  "no-legacy-sns-api": noLegacySnsApi,
  "no-closed-reward-type": noClosedRewardType,
  "min-v1-sdk-version": minV1SdkVersion,
  "min-sns-sdk-version": minSnsSdkVersion,
};

const CODE_RULES = Object.keys(rules).filter((r) => !r.startsWith("min-"));
const PKG_RULES = Object.keys(rules).filter((r) => r.startsWith("min-"));

export const CODE_FILES = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];
export const PKG_FILES = ["**/package.json"];
export const DOC_FILES = ["**/*.{md,mdx}"];

const plugin: ESLint.Plugin & { configs: Record<string, Linter.Config[]> } = {
  meta: { name: "eslint-plugin-solana-upgrade", version: "0.1.0" },
  rules: rules as any,
  processors: { markdown: createMarkdownProcessor() },
  configs: {},
};

const level = (names: string[], sev: Linter.RuleSeverity) =>
  Object.fromEntries(names.map((n) => [`${PLUGIN_NAME}/${n}`, sev])) as Linter.RulesRecord;

/** Flat config: TS/JS sources + package.json. */
plugin.configs.recommended = [
  {
    name: "solana-upgrade/code",
    files: CODE_FILES,
    plugins: { [PLUGIN_NAME]: plugin },
    languageOptions: {
      parser: tsParser as any,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
    },
    rules: level(CODE_RULES, "warn"),
  },
  {
    name: "solana-upgrade/package-json",
    files: PKG_FILES,
    plugins: { [PLUGIN_NAME]: plugin },
    languageOptions: { parser: jsoncParser as any },
    rules: level(PKG_RULES, "error"),
  },
];

/**
 * Flat config for code blocks in Markdown / MDX docs (JS/TS, JSON and curl JSON-RPC bodies).
 * Add it after `recommended`; the blocks are linted with the `recommended` code rules.
 */
plugin.configs.markdown = [
  {
    name: "solana-upgrade/markdown",
    files: DOC_FILES,
    plugins: { [PLUGIN_NAME]: plugin },
    processor: `${PLUGIN_NAME}/markdown`,
  },
];

export default plugin;
