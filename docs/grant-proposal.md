# solana-upgrade-check — Developer Tooling Grant Proposal
Solana Foundation — Application Template

## 1. Applicant Information

**Project / Tool Name:** solana-upgrade-check

**Applicant / Organization:** Norwave Studio (Poland)

**Primary Contact:** provided in the application form

**Total Amount Requested (USD):** $12,000

**Relevant Experience & Track Record**
Norwave Studio is a small independent software studio based in Poland. It builds, publishes and maintains its own apps on Google Play (Futoshiki Coach, PearlFall), so it is used to shipping and supporting released software. This is its first Solana project.

The working MVP is public, so the work can be judged directly: https://github.com/norwavestudio-art/solana-upgrade-check (Apache-2.0, v0.1.0)
- 10 ESLint rules, a CLI with text / JSON / SARIF output and `--fix`, a `status` command that reads 18 upgrade feature gates from any RPC, and a composite GitHub Action that uploads to code scanning.
- 123 tests (RuleTester per rule, CLI, SARIF and feature-gate decoding). CI runs them on Node 20, 22 and 24 and self-scans with the Action.
- Every rule cites a primary source (SIMD, Agave / Anza source, solana.com upgrade pages, SNS developer docs). The README lists facts that were checked and *not* turned into rules because no primary source confirmed them.
- The tool was validated on 10 widely used public Solana repositories (Foundation examples, developer helpers, the cookbook, a perps protocol SDK, Anchor, an RPC provider SDK, wallet-adapter and others):
  - 29 findings in non-test code;
  - 0 false positives on manual review;
  - Solana Explorer, which already handles v1, came back clean as a negative control.
  - The per-finding report is available to the Foundation on request; affected projects are notified through their own issue/PR process first.

## 2. Overview of Ecosystem Impact

**How is this project a public good for the Solana community?**
During 2026 the cluster changed under existing client code: Transaction v1 (SIMD-0296/0385), rent reduction (SIMD-0437, five steps), shorter slots (SIMD-0525) and the SNS `.sol` → `.sns` migration. Some breakages are loud:
- `getBlock` / `getTransaction` without `maxSupportedTransactionVersion: 1` fail with -32015 as soon as one v1 transaction is in the response.

Many are silent:
- indexers that read compute-budget instructions report zero CU limit and priority fee for v1 transactions;
- hard-coded rent-exempt amounts overpay, and equality checks break at every rent step;
- `slots × 400 ms` ETAs and 60–90 s blockhash timers drift.

Nobody gets an error, so these bugs ship.

solana-upgrade-check turns the upgrade notes into machine-checkable rules that run where developers already are: in the editor (ESLint), in CI (GitHub Action + SARIF) and once over a whole repo (CLI). It is free, Apache-2.0 and has no hosted component. Each rule links to its source, so it doubles as executable migration documentation. The rules have to follow every upgrade step (rent steps 3–5, further slot-time reductions, SIMD-0500), so a maintained version is worth more to the ecosystem than a one-off script.

**Specific benefits to Solana developers**
- A dApp or wallet team adds one workflow file. Pull requests that reintroduce `maxSupportedTransactionVersion: 0`, a hard-coded `2039280`, or `slots * 400` get annotated inline before merge.
- An indexer or analytics team runs `npx solana-upgrade-check scan .` once. They get a list of v1-unsafe lookups and compute-budget-only parsing, and safe autofixes for the unambiguous cases.
- SDK and template maintainers get `package.json` checks: does the declared range allow a version without v1 decoding (`@solana/kit` < 8, web3.js 1.x < 1.99.0, wallet-standard-features < 1.5.0, yellowstone-grpc < 6)?
- Ops and integration teams run `solana-upgrade-check status --cluster mainnet-beta` to see which upgrade gates are live now, instead of reading release notes.

## 3. Product Design

**Architecture & how it works**
- **ESLint plugin (flat config).** Each rule is an AST visitor over TS/JS, parsed with `@typescript-eslint/parser`. `package.json` rules use `jsonc-eslint-parser`. Rules are file-local and syntactic, and they stay silent when a value is not visible, to keep false positives low. Fixes are offered only when the rewrite is unambiguous (`0` → `1`, same-major version bumps); the rest are suggestions.
- **CLI.**
  - `scan` runs the plugin programmatically over a path. It excludes tests, mocks and fixtures by default and writes text, JSON or SARIF 2.1.0, with `--fix` and `--fail-on`.
  - `status` reads the upgrade feature-gate accounts with `getMultipleAccounts` and decodes their activation slots.
- **GitHub Action (composite).** It builds the tool, scans, uploads SARIF to code scanning, and gates the job on a severity threshold.
- **Source table.** Each rule's documentation records the primary source and the date it was last verified; it is re-verified on every release.

**Key features (v0.1.0, shipped)**
| Rule | What it catches |
|---|---|
| `require-max-supported-transaction-version` | `getBlock` / `getTransaction(s)` / `blockSubscribe` and raw JSON-RPC calls without `maxSupportedTransactionVersion: 1` (autofix) |
| `no-compute-budget-only-parsing` | CU / priority-fee extraction from ComputeBudget instructions only |
| `no-hardcoded-rent-exempt` | rent-exempt literals and per-byte constants |
| `no-hardcoded-slot-duration` | 400 ms / 2.5 slots/s constants and conversions |
| `no-wallclock-blockhash-expiry` | blockhash TTL as wall-clock time |
| `no-hardcoded-sol-suffix` | hard-coded `.sol` suffix |
| `no-legacy-sns-api` | renamed SNS SDK APIs |
| `no-closed-reward-type` | `RewardType` handling closed over the old variants |
| `min-v1-sdk-version` | SDK version floors without v1 decoding (autofix within major) |
| `min-sns-sdk-version` | SNS SDK version floors |

**Integration into existing developer workflows**
- ESLint: `import solanaUpgrade from "solana-upgrade-check"` and add `solanaUpgrade.configs.recommended` to `eslint.config.js`.
- CI: `uses: norwavestudio-art/solana-upgrade-check@v0.1.0`, with SARIF findings shown in the PR "Files changed" view.
- One-off audit: `npx solana-upgrade-check scan . --format sarif`.
- Weekly scheduled CI run, so new gates and SDK releases are caught between commits.

**Technology stack:** TypeScript, ESLint 9/10 flat-config API, `@typescript-eslint/parser`, `jsonc-eslint-parser`, `semver`, Node ≥ 20.19, `node:test`, SARIF 2.1.0, GitHub composite actions. There is no server and nothing is hosted.

**Proof-of-Concept:** https://github.com/norwavestudio-art/solana-upgrade-check (v0.1.0, CI green).

## 4. Budget Breakdown (Milestones)

### 4a. Completed First Version (Beta), per component — $5,500
| # | Component | Beta scope | Testing | Amount |
|---|---|---|---|---|
| B1 | Type-aware v1 sender rules + lockfile checks | Optional `parserOptions.project` mode. Rules for v1 senders that leave `computeUnitLimit` / `loadedAccountsDataSizeLimit` unset (both default to zero in v1) and for priority-fee unit conversion. Version rules read npm / pnpm / yarn lockfiles instead of range floors. | RuleTester valid/invalid cases per rule. A corpus of 30 public repos at pinned commits; precision ≥ 90% on manual review. | $2,500 |
| B2 | Distribution & docs | Published npm package. GitHub Marketplace listing. A docs site with one page per rule (problem, source, fix, examples). A `recommended` and a `strict` config. | Install smoke test on a fresh Kit app and a web3.js 1.x app in CI. | $1,000 |
| B3 | Beyond TS/JS + migration aids | Python (`solders` / `solana-py`) and Rust (`Cargo.toml` / `Cargo.lock`) version-floor checks in the CLI. Codemods for SNS SDK v3 → v4 call shapes. `status --watch` that diffs gates between runs. | Fixture repos per ecosystem. Codemod output compiled with `tsc` in CI. | $2,000 |

### 4b. Maintenance, 6 months — $3,000 ($500 / month)
Each month is one milestone. Maintenance covers:
- issues and bugs triaged within 72 h;
- a monthly release;
- new rules or rule updates within 7 days of a relevant SIMD or feature gate reaching mainnet (for example rent steps 3–5, further slot-time changes, SIMD-0500);
- every rule's primary sources re-verified and re-dated each release.

Evidence: GitHub releases, a changelog, and issue response times.

### 4c. User Adoption — $3,500
Paid in 25% tranches of each metric at the end of the period.
| Metric | Target (by month 6) | Tracking | Amount |
|---|---|---|---|
| Public repos using the Action or the plugin in CI | 25 | GitHub code search for `solana-upgrade-check` in workflow / ESLint config files; dependents graph | $1,000 |
| npm weekly downloads (4-week average) | 300 | npm downloads API | $1,000 |
| Upstream fixes merged in public Solana repos, using findings or autofixes from the tool | 8 | Links to merged PRs | $1,000 |
| Integrations into templates, starter kits or official docs | 3 | Links to merged integrations | $500 |

Metrics are reported monthly in a public issue on the repo.

### Milestone Summary
| # | Milestone / Deliverable | Success criteria | Amount (USD) |
|---|---|---|---|
| 1 | B1: type-aware v1 sender rules + lockfile checks | rules merged with tests; ≥ 90% precision on 30-repo corpus | 2,500 |
| 2 | B2: npm + Marketplace + docs site | package installable; docs page per rule | 1,000 |
| 3 | B3: Python/Rust version checks, SNS codemods, `status --watch` | fixtures pass in CI; codemod output compiles | 2,000 |
| 4–9 | Maintenance, months 1–6 | monthly release; 72 h triage; new gates covered within 7 days | 6 × 500 = 3,000 |
| 10 | Adoption: repos using the tool | 25 repos | 1,000 |
| 11 | Adoption: npm weekly downloads | 300 / week | 1,000 |
| 12 | Adoption: upstream fixes merged | 8 PRs | 1,000 |
| 13 | Adoption: integrations | 3 | 500 |
| | **Total** | | **12,000** |

## 5. Acknowledgements
- [✔] The project will release a published production version by the end of the grant agreement.
- [✔] The project will be completely public and open-source.
- [✔] The team agrees to at least 6 months of maintenance.
- [✔] The team agrees to meet quantifiable user-adoption metrics.
