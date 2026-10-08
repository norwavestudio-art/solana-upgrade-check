/**
 * Primary sources behind every rule. Each rule's `meta.docs.url` points to the
 * first entry; the README lists all of them with the date they were checked.
 */
export const VERIFIED_ON = "2026-10-08";

export interface Source {
  title: string;
  url: string;
}

export const SOURCES = {
  txV1Upgrade: {
    title: "solana.com — Larger Transaction Sizes (Transaction v1 upgrade page)",
    url: "https://solana.com/upgrades/larger-transaction-sizes",
  },
  simd0385: {
    title: "SIMD-0385 Transaction V1 Format",
    url: "https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0385-transaction-v1.md",
  },
  agaveValidateVersion: {
    title: "Agave transaction-status: validate_version / encode_with_options",
    url: "https://github.com/anza-xyz/agave/blob/master/transaction-status/src/lib.rs",
  },
  rpcGetBlock: {
    title: "solana.com RPC docs — getBlock",
    url: "https://solana.com/docs/rpc/http/getblock",
  },
  simd0437: {
    title: "SIMD-0437 Incrementally Reduce lamports_per_byte to 696",
    url: "https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0437-incremental-rent-reduction.md",
  },
  simd0194: {
    title: "SIMD-0194 Deprecate rent exemption threshold (3480 x 2.0 -> 6960 x 1.0)",
    url: "https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0194-deprecate-rent-exemption-threshold.md",
  },
  reducedRent: {
    title: "solana.com — Reduced Rent upgrade page",
    url: "https://solana.com/upgrades/reduced-rent",
  },
  simd0525: {
    title: "SIMD-0525 Reduce Slot Times",
    url: "https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0525-reduce-slot-times.md",
  },
  reducedSlots: {
    title: "solana.com — Reduced Slot Times upgrade page",
    url: "https://solana.com/upgrades/reduced-slot-times",
  },
  confirmationDocs: {
    title: "solana.com docs — Transaction confirmation & expiration",
    url: "https://solana.com/docs/advanced/confirmation",
  },
  snsMigration: {
    title: "SNS developer docs — Migration guide (.sol -> .sns)",
    url: "https://dev.sns.id/docs/migration/",
  },
  snsMigrationJs: {
    title: "SNS developer docs — JavaScript SDK v3 -> v4",
    url: "https://dev.sns.id/docs/migration/javascript",
  },
  snsMigrationKit: {
    title: "SNS developer docs — JS Kit SDK v0.10 -> v1",
    url: "https://dev.sns.id/docs/migration/js-kit",
  },
  snsFaq: {
    title: "SNS blog — Migration FAQ (pause at slot 452,825,395)",
    url: "https://www.sns.id/blog/migration-faq",
  },
  web3js199: {
    title: "@solana/web3.js v1.99.0 release — \"Add v1 Transaction read support\"",
    url: "https://github.com/solana-foundation/solana-web3.js/releases/tag/v1.99.0",
  },
  kit800: {
    title: "@solana/kit 8.0.0 changelog (version 1 transaction messages & transactionConfig types)",
    url: "https://github.com/anza-xyz/kit/blob/main/packages/kit/CHANGELOG.md",
  },
  rewardInfo: {
    title: "solana-sdk reward-info: RewardType enum (DeactivatedStake, VATDebit)",
    url: "https://github.com/anza-xyz/solana-sdk/blob/master/reward-info/src/lib.rs",
  },
  agaveFeatureSet: {
    title: "Agave feature-set (feature gate ids)",
    url: "https://github.com/anza-xyz/agave/blob/master/feature-set/src/lib.rs",
  },
} satisfies Record<string, Source>;

export type SourceKey = keyof typeof SOURCES;
