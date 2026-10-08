import type { Rule } from "eslint";
import { docs, type Node } from "../util.js";

/**
 * Renames documented in the official SNS migration guides.
 * `note` is shown when the call shape changes too (so a pure rename is not enough).
 */
interface Rename {
  to: string;
  note?: string;
}

const JS_SDK = "@bonfida/spl-name-service"; // v3 -> v4
const KIT_SDK = "@solana-name-service/sns-sdk-kit"; // v0.10 -> v1

const RENAMES: Record<string, Record<string, Rename>> = {
  [JS_SDK]: {
    getFavoriteDomain: { to: "getPrimaryDomain" },
    getDomainKeysWithReverses: { to: "getSnsDomainsForOwner", note: "result property `pubKey` is now `key`" },
    getRecordV2: { to: "getRecord", note: "v4 returns a structured RecordResult" },
    getRecords: { to: "getMultipleRecords" },
    getMultipleRecordsV2: { to: "getMultipleRecords" },
    registerDomainNameV2: { to: "registerDomain", note: "pass a full `.sns` name and drop the Connection argument" },
    registerWithNft: { to: "registerDomainWithNft", note: "pass a full `.sns` name; remove nftMetadata and masterEdition" },
    registerFavorite: { to: "setPrimaryDomain" },
    transferNameOwnership: { to: "transferDomain", note: "pass a full `.sns` name; remove class/parent arguments" },
    createRecordInstruction: { to: "createRecord", note: "consolidated signature" },
    createRecordV2Instruction: { to: "createRecord", note: "consolidated signature" },
    updateRecordInstruction: { to: "updateRecord", note: "consolidated signature" },
    updateRecordV2Instruction: { to: "updateRecord", note: "consolidated signature" },
    deleteRecordV2: { to: "deleteRecord", note: "pass a full `.sns` domain" },
  },
  [KIT_SDK]: {
    resolveDomain: { to: "resolve", note: "pass a full `.sns` name" },
    getDomainsForAddress: { to: "getSnsDomainsForAddress" },
    getNftsForAddress: { to: "getSnsNftsForAddress" },
    getDomainAddress: { to: "getSnsDomainAddress", note: "remove the legacy `.sol` suffix from its input" },
    getAllDomains: { to: "getAllSnsDomains" },
    getNftMint: { to: "getSnsNftMint" },
    getNftOwner: { to: "getSnsNftOwner" },
    validateRoa: { to: "validateRecordRoa" },
    validateRoaEthereum: { to: "validateRecordRoaEthereum" },
    writeRoa: { to: "setRecordRoaVerifier" },
  },
};

function packageOf(source: string): string | undefined {
  for (const pkg of Object.keys(RENAMES)) if (source === pkg || source.startsWith(pkg + "/")) return pkg;
  return undefined;
}

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: docs(
      "Flag SNS SDK APIs renamed or removed in @bonfida/spl-name-service v4 and @solana-name-service/sns-sdk-kit v1 (needed for `.sns` support)",
      "snsMigrationJs",
    ),
    hasSuggestions: true,
    schema: [],
    messages: {
      renamed: "`{{from}}` from {{pkg}} was renamed to `{{to}}` in the `.sns`-capable SDK{{note}}.",
      rename: "Rename to `{{to}}` (requires the upgraded SDK).",
    },
  },
  create(context) {
    const sc = context.sourceCode;
    return {
      ImportDeclaration(node: Node) {
        const pkg = packageOf(String(node.source.value));
        if (!pkg) return;
        for (const spec of node.specifiers) {
          if (spec.type !== "ImportSpecifier") continue;
          const from = spec.imported.name ?? spec.imported.value;
          const r = Object.hasOwn(RENAMES[pkg], from) ? RENAMES[pkg][from] : undefined;
          if (!r) continue;
          const aliased = spec.local.name !== from;
          context.report({
            node: spec,
            messageId: "renamed",
            data: { from, to: r.to, pkg, note: r.note ? ` — ${r.note}` : "" },
            // Never an autofix: the new name only exists after a major SDK upgrade,
            // and several calls also change shape.
            suggest: [
              {
                messageId: "rename",
                data: { to: r.to },
                fix: (fixer) => {
                  if (aliased) return fixer.replaceText(spec.imported, r.to);
                  const fixes = [fixer.replaceText(spec, r.to)];
                  const [variable] = sc.getDeclaredVariables(spec);
                  for (const ref of variable?.references ?? []) fixes.push(fixer.replaceText(ref.identifier, r.to));
                  return fixes;
                },
              },
            ],
          });
        }
      },
    } as Rule.RuleListener;
  },
};

export default rule;
