import { Connection, ComputeBudgetProgram } from "@solana/web3.js";

const MS_PER_SLOT = 400;
const TOKEN_ACCOUNT_RENT = 2039280;
const BLOCKHASH_EXPIRY_MS = 60_000;

export async function indexBlock(conn: Connection, slot: number) {
  const block = await conn.getBlock(slot, { maxSupportedTransactionVersion: 0 });
  let fees = 0;
  for (const tx of block?.transactions ?? []) {
    for (const ix of tx.transaction.message.compiledInstructions) {
      const programId = tx.transaction.message.staticAccountKeys[ix.programIdIndex];
      if (programId.equals(ComputeBudgetProgram.programId)) fees += 1;
    }
  }
  for (const r of block?.rewards ?? []) {
    switch (r.rewardType) {
      case "Fee":
        fees += r.lamports;
        break;
      case "Voting":
        break;
    }
  }
  return { fees, etaMs: (slot - (await conn.getSlot())) * MS_PER_SLOT, TOKEN_ACCOUNT_RENT, BLOCKHASH_EXPIRY_MS };
}
