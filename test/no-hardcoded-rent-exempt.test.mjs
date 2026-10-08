import { tsTester, rule } from "./helpers.mjs";

const name = "no-hardcoded-rent-exempt";

tsTester.run(name, rule(name), {
  valid: [
    `const rent = await connection.getMinimumBalanceForRentExemption(165);`,
    `const timeout = 6960;`, // per-byte value without rent context
    `const price = 2_000_000;`,
    `const n = 3_480_000;`, // divisible by 10000: treated as a round number
    `const width = 400 * 6333;`,
  ],
  invalid: [
    { code: `const TOKEN_ACCOUNT_RENT = 2039280;`, errors: [{ messageId: "exemptAmount", data: { value: "2039280", desc: "165 bytes at the legacy 6960 lamports/byte" } }] },
    { code: `if (balance === 890_880) {}`, errors: [{ messageId: "exemptAmount" }] },
    { code: `const MINT_RENT = 1461600n;`, errors: [{ messageId: "exemptAmount" }] },
    { code: `const r = 1855569;`, errors: [{ messageId: "exemptAmount", data: { value: "1855569", desc: "165 bytes at 6333 lamports/byte" } }] },
    { code: `const LAMPORTS_PER_BYTE = 6960;`, errors: [{ messageId: "perByte" }] },
    { code: `const min = (128 + dataSize) * 6960;`, errors: [{ messageId: "perByte" }] },
    { code: `const rentExempt = space * 3480 * 2;`, errors: [{ messageId: "perByte" }] },
    { code: `const cfg = { lamportsPerByte: 5080 };`, errors: [{ messageId: "perByte" }] },
  ],
});
