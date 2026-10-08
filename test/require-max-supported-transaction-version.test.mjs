import { tsTester, rule, W3 } from "./helpers.mjs";

const name = "require-max-supported-transaction-version";

tsTester.run(name, rule(name), {
  valid: [
    W3 + `conn.getTransaction(sig, { maxSupportedTransactionVersion: 1 });`,
    W3 + `conn.getBlock(slot, { maxSupportedTransactionVersion: 1, transactionDetails: "full" });`,
    W3 + `conn.getBlock(slot, { transactionDetails: "signatures" });`,
    W3 + `conn.getBlock(slot, { transactionDetails: "none", rewards: false });`,
    W3 + `conn.getTransaction(sig, { ...base });`,
    W3 + `conn.getTransaction(sig, cfgFromElsewhere);`,
    W3 + `const cfg = { maxSupportedTransactionVersion: 1 }; conn.getTransaction(sig, cfg);`,
    // not a Solana file: ethers-style getBlock is ignored by default
    `provider.getBlock(123);`,
    `rpc.getBlock(5n).send();`,
    // raw JSON-RPC done right
    `fetch(url, { body: JSON.stringify({ method: "getBlock", params: [1, { maxSupportedTransactionVersion: 1 }] }) });`,
    W3 + `conn.getSignaturesForAddress(addr);`,
    // regression: Object.prototype members must not be treated as RPC methods
    W3 + `const s = x.toString(); const h = y.hasOwnProperty("a"); const c = z.constructor(1);`,
  ],
  invalid: [
    {
      code: W3 + `conn.getTransaction(sig, { maxSupportedTransactionVersion: 0 });`,
      output: W3 + `conn.getTransaction(sig, { maxSupportedTransactionVersion: 1 });`,
      errors: [{ messageId: "tooLow" }],
    },
    {
      code: W3 + `conn.getBlock(slot, { maxSupportedTransactionVersion: "1" });`,
      output: W3 + `conn.getBlock(slot, { maxSupportedTransactionVersion: 1 });`,
      errors: [{ messageId: "notInteger" }],
    },
    {
      code: `import { createSolanaRpc } from "@solana/kit";\nawait rpc.getTransaction(sig, { encoding: "json" }).send();`,
      output: null,
      errors: [
        {
          messageId: "missing",
          suggestions: [
            {
              messageId: "addProperty",
              output: `import { createSolanaRpc } from "@solana/kit";\nawait rpc.getTransaction(sig, { encoding: "json", maxSupportedTransactionVersion: 1 }).send();`,
            },
          ],
        },
      ],
    },
    {
      code: W3 + `await conn.getParsedTransaction(sig);`,
      output: null,
      errors: [
        {
          messageId: "missing",
          suggestions: [
            { messageId: "addConfig", output: W3 + `await conn.getParsedTransaction(sig, { maxSupportedTransactionVersion: 1 });` },
          ],
        },
      ],
    },
    {
      code: W3 + `await conn.getTransaction(sig, "confirmed");`,
      output: null,
      errors: [
        {
          messageId: "missing",
          suggestions: [
            { messageId: "addConfig", output: W3 + `await conn.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 1 });` },
          ],
        },
      ],
    },
    {
      code: W3 + `const cfg = { commitment: "confirmed" };\nconn.getBlock(slot, cfg);`,
      output: null,
      errors: [{ messageId: "missing", suggestions: [] }],
    },
    {
      code: `rpcSubscriptions.blockNotifications("all", {}).subscribe();\nimport "@solana/kit";`,
      output: null,
      errors: [
        {
          messageId: "missing",
          suggestions: [
            { messageId: "addProperty", output: `rpcSubscriptions.blockNotifications("all", { maxSupportedTransactionVersion: 1 }).subscribe();\nimport "@solana/kit";` },
          ],
        },
      ],
    },
    {
      // raw JSON-RPC, no import needed
      code: `const body = { jsonrpc: "2.0", id: 1, method: "getTransaction", params: [sig, { encoding: "json", maxSupportedTransactionVersion: 0 }] };`,
      output: `const body = { jsonrpc: "2.0", id: 1, method: "getTransaction", params: [sig, { encoding: "json", maxSupportedTransactionVersion: 1 }] };`,
      errors: [{ messageId: "tooLow" }],
    },
    {
      code: `const body = { method: "blockSubscribe", params: ["all"] };`,
      output: null,
      errors: [
        {
          messageId: "missing",
          suggestions: [{ messageId: "addConfig", output: `const body = { method: "blockSubscribe", params: ["all", { maxSupportedTransactionVersion: 1 }] };` }],
        },
      ],
    },
  ],
});

// requireSolanaImport: false lints any file
tsTester.run(name + " (requireSolanaImport=false)", rule(name), {
  valid: [],
  invalid: [
    {
      code: `rpc.getBlock(5n, { maxSupportedTransactionVersion: 0 });`,
      options: [{ requireSolanaImport: false }],
      output: `rpc.getBlock(5n, { maxSupportedTransactionVersion: 1 });`,
      errors: [{ messageId: "tooLow" }],
    },
  ],
});
