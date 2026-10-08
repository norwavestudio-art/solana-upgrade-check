# solana-upgrade-check

An ESLint plugin, CLI and GitHub Action that find TypeScript/JavaScript code and `package.json` entries broken, or quietly made wrong, by the 2026 Solana protocol and ecosystem upgrades:

- **Transaction v1**: SIMD-0296 / SIMD-0385, live on mainnet since 2026-09-15.
- **Rent reduction**: SIMD-0437, two of five steps live.
- **Shorter slots**: SIMD-0525, 400 → 250 ms live, 200 ms activated in epoch 1052.
- **SNS `.sol` → `.sns` migration.**

Every rule is backed by a primary source: a SIMD, the Agave / Anza source, solana.com, or the SNS developer docs. If a fact could not be confirmed in a primary source, there is no rule for it.

> Status: **MVP / pre-release (0.1.0)**. Not published to npm or the GitHub Marketplace yet; the Action can be used from this repository by tag.

## The problem

During 2026 the cluster changed under existing client code:

| Change | What breaks in client code | Fails loudly? |
|---|---|---|
| Transaction v1 (SIMD-0385) | `getBlock` / `getTransaction` / `blockSubscribe` without `maxSupportedTransactionVersion: 1` fail as soon as a v1 transaction is in the response. One v1 transaction fails a whole `getBlock`. | yes (RPC error -32015) |
| Transaction v1 | Indexers that derive CU limit / priority fee from ComputeBudget instructions report **zero** for v1 transactions; the values now live in `transactionConfig`. | **no** |
| Transaction v1 | SDKs older than `@solana/kit` 8.0.0 / `@solana/web3.js` 1.99.0 (1.x) / 3.0.2 (3.x) cannot decode v1. | yes |
| Rent (SIMD-0437) | Hard-coded rent-exempt amounts (`2039280`, `890880`, `6960 * (128 + n)`…) overpay, and equality checks break, at every step: 6960 → 6333 → 5080 → 2575 → 1322 → 696. | often no |
| Slot time (SIMD-0525) | `slots * 400ms` ETAs, countdowns and vesting estimates drift. The blockhash window is still 150 blocks, but now lasts ~50 s (and ~40 s at 200 ms) instead of 60–90 s. | **no** |
| SNS migration | Existing domains display and resolve as `.sns`. SNS-backed `.sol` resolution pauses in the official SDKs at slot 452,825,395. SDK v3 / Kit SDK v0.10 APIs were renamed. | partly |
| RewardType | `DeactivatedStake` and `VATDebit` were added to `RewardType`. Closed `switch`es and union types silently drop them. | no |

`solana-upgrade-check` finds these patterns statically. Where a fix is unambiguous it rewrites the code, and it can tell you which feature gates are live on a cluster right now.

## Install

The package is not on npm yet. To try it from a checkout:

```bash
git clone https://github.com/norwavestudio-art/solana-upgrade-check.git && cd solana-upgrade-check
npm ci && npm run build
npm pack                      # -> solana-upgrade-check-0.1.0.tgz
cd /path/to/your/app && npm i -D /path/to/solana-upgrade-check-0.1.0.tgz eslint
```

Requirements: Node.js ≥ 20.19, ESLint 9 or 10 (flat config).

### As an ESLint plugin (flat config)

```js
// eslint.config.js
import solanaUpgrade from "solana-upgrade-check";

export default [
  ...solanaUpgrade.configs.recommended, // TS/JS rules = warn, package.json rules = error
  // or pick rules yourself:
  // { plugins: { "solana-upgrade": solanaUpgrade },
  //   rules: { "solana-upgrade/require-max-supported-transaction-version": "error" } },
];
```

`configs.recommended` brings its own parsers: `@typescript-eslint/parser` for `**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}` and `jsonc-eslint-parser` for `**/package.json`. If your config already sets a parser for those globs, keep yours and only add `plugins` and `rules`.

### CLI

```bash
solana-upgrade-check scan <path> [--format text|json|sarif] [--output file] [--fix]
                                 [--fail-on error|warning|none] [--ignore <glob>] [--include-tests]
solana-upgrade-check status [--cluster mainnet|devnet|testnet | --rpc <url>] [--json]
solana-upgrade-check rules
```

- `scan` does not need an ESLint config in the target repo: it runs the plugin with its own config. It skips `node_modules`, build output, tests, mocks, fixtures and stories by default; pass `--include-tests` to scan them too. The exit code is 1 when there are findings at or above `--fail-on`.
- `--fix` applies only the safe autofixes listed below and writes them to disk.
- `status` reads the feature-gate accounts with one `getMultipleAccounts` call, plus `getEpochSchedule` and `getEpochInfo`, against any JSON-RPC endpoint. The default is the public mainnet endpoint. Example output from 2026-10-08:

```
RPC https://api.mainnet-beta.solana.com  slot 454499280  epoch 1052  node 4.3.0
SIMD-0385    Transaction V1 (enable_tx_v1)        ACTIVE since slot 447120000 (epoch 1035)
SIMD-0437-1  Rent: lamports_per_byte 6333         ACTIVE since slot 444096000 (epoch 1028)
SIMD-0437-2  Rent: lamports_per_byte 5080         ACTIVE since slot 446256000 (epoch 1033)
SIMD-0437-3  Rent: lamports_per_byte 2575         not scheduled (no feature account)
SIMD-0525    Slot time 250ms                      ACTIVE since slot 447552000 (epoch 1036), in effect since epoch 1037
SIMD-0525    Slot time 200ms                      ACTIVE since slot 454464000 (epoch 1052), takes effect at epoch 1053 (slot 454896000)
SIMD-0500    Disable deployment of SBPF v0/v1/v2  not scheduled (no feature account)
SIMD-0326    Alpenglow consensus                  not scheduled (no feature account)
...
```

The status command tracks these gates: SIMD-0385, 0194, 0392, 0437 (steps 1–5), 0438 (rent reset fallback), 0525 (×4), 0500 and 0326. The ids come from Agave's `feature-set/src/lib.rs`. For SIMD-0525, the "takes effect" epoch follows the SIMD's one-epoch delay rule.

### GitHub Action

`action.yml` is a composite action. It scans the repository, uploads SARIF to code scanning (optional), and fails the job according to `fail-on`. A ready-to-copy workflow is in [`examples/workflow.yml`](examples/workflow.yml):

```yaml
permissions: { contents: read, security-events: write }
steps:
  - uses: actions/checkout@v4
  - uses: norwavestudio-art/solana-upgrade-check@v0.1.0
    with: { path: ".", fail-on: error, upload-sarif: "true" }
```

## Rules

All sources below were checked on **2026-10-08**.
Legend: **autofix** = safe fix applied by `--fix` / `eslint --fix`; **suggestion** = editor suggestion only (needs a human decision).

| Rule | What it flags | Fix | Primary sources (checked 2026-10-08) |
|---|---|---|---|
| `require-max-supported-transaction-version` | `getBlock`, `getParsedBlock`, `getTransaction(s)`, `getParsedTransaction(s)` (web3.js / Kit), Kit `blockNotifications`, and raw JSON-RPC `getBlock` / `getTransaction` / `blockSubscribe` bodies without `maxSupportedTransactionVersion: 1`, or with `0` / `"1"`. Skips `transactionDetails: "signatures" \| "none"`, which Agave does not version-check. | autofix: `0`/`"1"` → `1`; suggestion: add the option (web3.js changes the return type) | [solana.com: Larger Transaction Sizes](https://solana.com/upgrades/larger-transaction-sizes) ("Passing 0 or legacy fails on v1 transactions exactly like omitting the parameter"; -32015; `blockSubscribe` emits `block: null`); [Agave `validate_version` / `encode_with_options`](https://github.com/anza-xyz/agave/blob/master/transaction-status/src/lib.rs); [SIMD-0385](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0385-transaction-v1.md) |
| `no-compute-budget-only-parsing` | Files that fetch transactions (`getTransaction`, `getBlock`, `blockNotifications`, Geyser `SubscribeUpdate*`…) and identify ComputeBudget instructions (program-id comparisons, `identifyComputeBudgetInstruction`, `ComputeBudgetInstruction.decode*`) but never read `transactionConfig`. | — | [solana.com: Larger Transaction Sizes → For Indexers](https://solana.com/upgrades/larger-transaction-sizes) ("will report zero for every v1 transaction, without erroring"; v1 priority fee is a lamport total) |
| `no-hardcoded-rent-exempt` | Integer literals equal to `(128 + n) × 6960` (legacy rent-exempt minimum), known account sizes at 6333/5080/2575/1322/696, and per-byte constants (6960, 3480, step values) in rent/size contexts. | — (use `getMinimumBalanceForRentExemption` / Rent sysvar) | [SIMD-0437](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0437-incremental-rent-reduction.md) (`min_balance = (128 + size) * lamports_per_byte`, 5 steps); [SIMD-0194](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0194-deprecate-rent-exemption-threshold.md) (3480 × 2.0 → 6960 × 1.0); [solana.com: Reduced Rent](https://solana.com/upgrades/reduced-rent) |
| `no-hardcoded-slot-duration` | 400 ms / 0.4 s / 2.5 slots/s / 160 ticks/s bound to slot-time names (`MS_PER_SLOT`, `slotDurationMs`…), `slots * 400`-style conversions, and imports of `MS_PER_SLOT`-like constants. | — | [SIMD-0525](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0525-reduce-slot-times.md) ("static constants for default slot duration… will be out of sync with chain reality"); [solana.com: Reduced Slot Times](https://solana.com/upgrades/reduced-slot-times) ("A slot count multiplied by 400ms no longer describes elapsed time") |
| `no-wallclock-blockhash-expiry` | Blockhash TTL / expiry constants in ms or s (e.g. `BLOCKHASH_EXPIRY_MS = 60_000`) and 60/80/90 s timers in blockhash-refresh code. Block-count constants (150/151) are allowed. | — (use `lastValidBlockHeight`) | [solana.com: Reduced Slot Times](https://solana.com/upgrades/reduced-slot-times) (150 blocks ≈ 50 s at 250 ms, ≈ 40 s at 200 ms); [SIMD-0525 Drawbacks](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0525-reduce-slot-times.md) (blockhash queue unchanged); [solana.com docs: confirmation & expiration](https://solana.com/docs/advanced/confirmation) |
| `no-hardcoded-sol-suffix` | `` `${domain}.sol` ``, `name + ".sol"`, `"name.sol"` literals passed to resolve/domain APIs, and `.endsWith(".sol")`, `.replace(".sol", …)`, `/\.sol$/` checks. Outside files that import an SNS SDK, it only fires on domain-like names, so Solidity paths are not flagged. | autofix: in files importing an SNS SDK (template / concatenation); suggestion: otherwise and for literals | [SNS migration guide](https://dev.sns.id/docs/migration/) ("Replace .sol with .sns wherever your frontend displays existing SNS domains", with this exact before/after); [SNS Migration FAQ](https://www.sns.id/blog/migration-faq) (pause at slot 452,825,395) |
| `no-legacy-sns-api` | Imports of APIs renamed in `@bonfida/spl-name-service` v4 (e.g. `getFavoriteDomain` → `getPrimaryDomain`, `getDomainKeysWithReverses` → `getSnsDomainsForOwner`) and `@solana-name-service/sns-sdk-kit` v1 (e.g. `resolveDomain` → `resolve`, `getDomainsForAddress` → `getSnsDomainsForAddress`). | suggestion: rename import and references (only valid after the SDK upgrade) | [SNS: JavaScript SDK v3 → v4](https://dev.sns.id/docs/migration/javascript); [SNS: JS Kit SDK v0.10 → v1](https://dev.sns.id/docs/migration/js-kit) |
| `no-closed-reward-type` | `switch (x.rewardType)` that handles only Fee/Rent/Staking/Voting with no `default`; closed union types of those values; `enum RewardType` without the new members. | suggestion: add `default` / add union members | [solana-sdk `reward-info` `RewardType`](https://github.com/anza-xyz/solana-sdk/blob/master/reward-info/src/lib.rs) (`DeactivatedStake` added 2026-03-24, `VATDebit` added 2026-09-05) |
| `min-v1-sdk-version` (package.json) | `@solana/kit` < 8.0.0; `@solana/web3.js` 1.x < 1.99.0, any 2.x, 3.x < 3.0.2; `@solana/wallet-standard-features` < 1.5.0; `@triton-one/yellowstone-grpc` < 6.0.0. The check uses the lowest version the range allows. `peerDependencies` are checked only with `{ includePeer: true }`. | autofix: same-major bump (`^1.95.4` → `^1.99.0`); major upgrades are never auto-fixed | [solana.com: Larger Transaction Sizes → "Support for V1 Transactions" table](https://solana.com/upgrades/larger-transaction-sizes); [web3.js v1.99.0 release](https://github.com/solana-foundation/solana-web3.js/releases/tag/v1.99.0) ("Add v1 Transaction read support"); [Kit 8.0.0 changelog](https://github.com/anza-xyz/kit/blob/main/packages/kit/CHANGELOG.md) |
| `min-sns-sdk-version` (package.json) | `@bonfida/spl-name-service` < 4.0.0, `@solana-name-service/sns-sdk-kit` < 1.0.0. | — (major upgrade with API changes) | [SNS migration guide](https://dev.sns.id/docs/migration/) (upgrade the SDK: JS v4, JS Kit v1) |

### Facts that were checked but not turned into rules (not confirmed, or not detectable reliably)

- **Geyser "write-locked but unchanged accounts no longer emit updates" (Agave 4.2).** This was only in a secondary source (a Triton blog post) and could not be found in the Agave CHANGELOG. No rule.
- **v1 senders must set `computeUnitLimit` and `loadedAccountsDataSizeLimit` explicitly (both default to zero).** This is confirmed by solana.com and the Kit 8.0.0 changelog, but it cannot be detected reliably without type information, because the limits are often set by helpers. Planned for Beta (type-aware).
- **`jsonParsed` confidential-transfer Deposit/Withdraw replaced `source`/`destination` with `account`.** Confirmed in the Agave 4.2.0 CHANGELOG. It was left out of the MVP because usage is rare. Planned.
- **SBPF v0–v2 deployment ban (SIMD-0500).** This affects on-chain programs and build tooling, not TS/JS clients, and [`solcompat`](https://github.com/Memewtoo/solcompat) already covers it. We only report the gate in `status`.
- **Whether the SNS SDK pause actually took effect on-chain.** The SNS docs state that v4 / Kit v1 "pause automatically at finalized slot 452,825,395". We did not verify the runtime behaviour.
- **Rent steps 3–5 feature ids.** solana.com/upgrades/reduced-rent lists different ids (`Ftxb3…`, `GsUBN…`, `mZdnR…`) from Agave master (`rntCig…`, `rntD7…`, `rntTj…`). `status` queries both sets and labels the solana.com ids "alt id". As of 2026-10-08, neither set has a feature account on mainnet.
- **solana.com's confirmation docs still say slots are "about 400ms" and blockhashes last "60 to 90 seconds".** The newer upgrade pages give ~50 s at 250 ms. The rule follows the newer pages and SIMD-0525.

## Results on public repositories

On 2026-10-08 the CLI was run against 10 widely used public Solana repositories (SDKs, examples, wallet and DeFi clients) at pinned commits, without installing or running their code. Default mode (tests, mocks and fixtures excluded) produced 29 findings; manual review found no false positives among them. Most are `maxSupportedTransactionVersion: 0` lookups on arbitrary signatures and `package.json` ranges whose floor predates v1 support. The Solana Explorer, which already handles v1, came back clean, which makes it a useful negative control. Two rule bugs found by this run were fixed, with regression tests.

The per-finding report is not published. The affected projects will be notified through their normal issue/PR process first.

## Limitations

- Purely syntactic, file-local analysis: no type information and no cross-file data flow. A config object built elsewhere, or a v1 branch in another module, is invisible to the rule. Rules stay silent when they cannot see the value, to keep false positives low.
- Version rules read `package.json` ranges (their floor), not lockfiles.
- Name-based heuristics (slot time, blockhash TTL, domain-like names) can miss renamed code and can occasionally fire on unrelated code that uses the same names.
- TS/JS only. Python (`solders`, ≥ 0.29.0), Rust (`solana-*` 4.2.x) and Go (`solana-go` 1.23.0) minimums are documented by solana.com but not checked yet.
- `status` relies on whichever RPC you point it at. Public endpoints are rate-limited.

## Relationship to other tools

[`Memewtoo/solcompat`](https://github.com/Memewtoo/solcompat) (Rust CLI, Apache-2.0) checks literal `getBlock` / `getTransaction` calls, decoder versions, and sBPFv3 / Anchor / Pinocchio build profiles. `solana-upgrade-check` is complementary. It runs as an ESLint plugin inside editors and existing lint pipelines, ships autofixes, adds the rent / slot-time / blockhash / SNS / RewardType rules, and reads live gate status. Overlapping rules can be contributed upstream.

## Roadmap (6 months, proposal for Solana Foundation — Developer Tooling)

| Milestone | When | Deliverables | Acceptance |
|---|---|---|---|
| **M1 — Beta (components)** | month 1 | npm package and GitHub Marketplace action published. Type-aware mode (`parserOptions.project`) for v1 sender rules (explicit `computeUnitLimit` / `loadedAccountsDataSizeLimit`, priority-fee unit conversion). Lockfile-aware version checks (npm/pnpm/yarn). `jsonParsed` confidential-transfer rule. Docs site with one page per rule. | ≥ 14 rules, ≥ 95% rule test coverage, 0 known FP in the 10-repo corpus |
| **M2 — Ecosystem coverage** | months 2–3 | Python (`solders` / `solana-py`) and Rust (`Cargo.toml` / `Cargo.lock`) version checks. Codemods for SNS v3 → v4 call shapes. `status --watch` that diffs gates between runs, for CI cron. Upstream proposals to solcompat where rules overlap. | Corpus grows to 30 public repos; precision ≥ 90% on manual review |
| **M3 — Maintenance (≥ 6 months, monthly)** | months 1–6 | Track each new feature gate and SDK minimum (rent steps 3–5 in Agave 4.4, SIMD-0500, Alpenglow, future slot/limit changes) within 7 days of a SIMD reaching mainnet. Monthly release, triage within 72 h, and a re-dated primary-source table on every release. | 6 monthly releases; every rule's sources re-verified each month |
| **M4 — Adoption** | months 3–6 | Paid out against measured adoption (25% tranches). | Targets: ≥ 50 repos using the Action, ≥ 1 000 weekly npm downloads, ≥ 10 merged upstream fixes in public Solana repos, ≥ 3 integrations (templates / starter kits) |

Metrics will be reported monthly from public data: npm downloads, GitHub dependents and code search for the action, and merged PRs.

## Development

```bash
npm ci
npm test            # builds, then runs node:test (RuleTester per rule, CLI + SARIF, status decoding)
node dist/cli.js scan examples/legacy-app
node dist/cli.js status --cluster devnet
```

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
