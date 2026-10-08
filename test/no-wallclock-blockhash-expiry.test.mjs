import { tsTester, rule } from "./helpers.mjs";

const name = "no-wallclock-blockhash-expiry";

tsTester.run(name, rule(name), {
  valid: [
    `const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();`,
    `const BLOCKHASH_VALID_SLOTS = 150;`,
    `const MAX_BLOCKHASH_AGE_BLOCKS = 151;`,
    `setTimeout(poll, 60_000);`,
    `const REQUEST_TIMEOUT_MS = 60000;`,
  ],
  invalid: [
    { code: `const BLOCKHASH_EXPIRY_MS = 60_000;`, errors: [{ messageId: "wallclock" }] },
    { code: `const blockhashTtl = 90000;`, errors: [{ messageId: "wallclock" }] },
    { code: `const BLOCKHASH_LIFETIME_SECONDS = 60;`, errors: [{ messageId: "wallclock" }] },
    { code: `const cfg = { blockhashRefreshMs: 80000 };`, errors: [{ messageId: "wallclock" }] },
    {
      code: `async function keepFresh() { const { blockhash } = await conn.getLatestBlockhash(); setTimeout(keepFresh, 60000); }`,
      errors: [{ messageId: "wallclock" }],
    },
  ],
});
