import { tsTester, rule, W3 } from "./helpers.mjs";

const name = "no-compute-budget-only-parsing";

tsTester.run(name, rule(name), {
  valid: [
    // building transactions is fine
    W3 + `tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }));`,
    // reads both
    W3 + `if (ix.programId.equals(ComputeBudgetProgram.programId)) {}\nconst cfg = tx.transaction.message.transactionConfig;`,
    `const x = programId === "SomethingElse111111111111111111111111111111";`,
    // sender-side: filtering ComputeBudget ixs while building a transaction (no chain reads in file)
    W3 + `const ixs = swapIxs.filter((ix) => !ix.programId.equals(ComputeBudgetProgram.programId));`,
  ],
  invalid: [
    {
      code: W3 + `const tx = await conn.getTransaction(sig, cfg);\nfor (const ix of msg.instructions) { if (ix.programId.equals(ComputeBudgetProgram.programId)) { cu = decode(ix); } }`,
      errors: [{ messageId: "cbOnly" }],
    },
    {
      code: `const tx = await rpc.getTransaction(sig, cfg).send();\nif (programId === "ComputeBudget111111111111111111111111111111") { fee += 1; }`,
      errors: [{ messageId: "cbOnly" }],
    },
    {
      code: `import { identifyComputeBudgetInstruction } from "@solana-program/compute-budget";\nrpcSubscriptions.blockNotifications("all", cfg);\nconst kind = identifyComputeBudgetInstruction(ix);\nconst k2 = identifyComputeBudgetInstruction(ix2);`,
      errors: [{ messageId: "cbOnly" }], // reported once per file
    },
    {
      code: `const b = await conn.getParsedBlock(slot, cfg);\nif (ix.programId.toBase58() === ComputeBudgetProgram.programId.toBase58()) {}`,
      errors: [{ messageId: "cbOnly" }],
    },
    {
      code: `// geyser: SubscribeUpdateTransaction\nconst price = ComputeBudgetInstruction.decodeSetComputeUnitPrice(ix);`,
      errors: [{ messageId: "cbOnly" }],
    },
  ],
});
