/**
 * Feature gates relevant to client code, with ids taken from
 * anza-xyz/agave feature-set/src/lib.rs (master, checked 2026-10-08).
 */
export interface FeatureGate {
  id: string;
  simd: string;
  name: string;
  /** Extra note shown in `status` output. */
  note?: string;
  /** SIMD-0525 gates take effect one epoch after activation. */
  effectiveNextEpoch?: boolean;
  /** Where the id comes from. */
  source: "agave-feature-set" | "solana.com/upgrades/reduced-rent";
}

export const FEATURE_GATES: FeatureGate[] = [
  { id: "txv1aq4pp281K9um3tnPgkfX8UqtFT6wcVW3hNezGLL", simd: "SIMD-0385", name: "Transaction V1 (enable_tx_v1)", source: "agave-feature-set" },
  { id: "rent6iVy6PDoViPBeJ6k5EJQrkj62h7DPyLbWGHwjrC", simd: "SIMD-0194", name: "Deprecate rent exemption threshold", source: "agave-feature-set" },
  { id: "BY4JhHLahVzS9ynfDz4exzGPbVXhFmJvEyMWsXbDBqME", simd: "SIMD-0392", name: "Relax post-execution min_balance check", source: "agave-feature-set" },
  { id: "4a6f7o7iTcA8hRDCrPLkSatnt5Ykxiu36wo5p1Tt12wC", simd: "SIMD-0437-1", name: "Rent: lamports_per_byte 6333", source: "agave-feature-set" },
  { id: "61BtM7BkDEE8Yq5fskEVAQT9mYA8qCejJWoLe5apqg81", simd: "SIMD-0437-2", name: "Rent: lamports_per_byte 5080", source: "agave-feature-set" },
  { id: "rntCigrTppP5JdZz7K8TyN9sMzLdAcXp8SejYpVpX6D", simd: "SIMD-0437-3", name: "Rent: lamports_per_byte 2575", source: "agave-feature-set" },
  { id: "rntD7invRBswCAdKtRsh1G4psKjrPdS3BKqtnA78C7N", simd: "SIMD-0437-4", name: "Rent: lamports_per_byte 1322", source: "agave-feature-set" },
  { id: "rntTjNZ9boq8owDxjGVFHPfWNQPDaKiM5JcjxmDGg47", simd: "SIMD-0437-5", name: "Rent: lamports_per_byte 696", source: "agave-feature-set" },
  // solana.com/upgrades/reduced-rent lists different ids for steps 3-5 than agave master.
  { id: "Ftxb3ZKq7aNqgxDBbP7EonvR2RszZk9ctjdsTX38kQaz", simd: "SIMD-0437-3", name: "Rent: lamports_per_byte 2575 (alt id)", source: "solana.com/upgrades/reduced-rent", note: "id differs from agave master" },
  { id: "GsUBNYNDPdMLHPD37TToHzrzcNcjpC9w5n1EcJk5iTaM", simd: "SIMD-0437-4", name: "Rent: lamports_per_byte 1322 (alt id)", source: "solana.com/upgrades/reduced-rent", note: "id differs from agave master" },
  { id: "mZdnRh9T2EbDNvqKjkCR3bvo5c816tJaojtE9Xs7iuY", simd: "SIMD-0437-5", name: "Rent: lamports_per_byte 696 (alt id)", source: "solana.com/upgrades/reduced-rent", note: "id differs from agave master" },
  { id: "rnt8ZQpz2HYhX3DkYBDGjJS1a36mYq69oXka7JrhEdi", simd: "SIMD-0438", name: "Rent: reset lamports_per_byte to 6960 (fallback)", source: "agave-feature-set" },
  { id: "iBRL5RuWhw4yqaAZu96RUULHckHTZAoe2b77qaV38JZ", simd: "SIMD-0525", name: "Slot time 350ms", effectiveNextEpoch: true, source: "agave-feature-set" },
  { id: "iBRLL3k18HST852F1Mf3Lv83waTNQmmqvKDxvYGwQFL", simd: "SIMD-0525", name: "Slot time 300ms", effectiveNextEpoch: true, source: "agave-feature-set" },
  { id: "iBRLMc81UjRa8fn8A6eE8bJTnRbgQoPTynM51akENCV", simd: "SIMD-0525", name: "Slot time 250ms", effectiveNextEpoch: true, source: "agave-feature-set" },
  { id: "iBRLjhJnkmDZgNoZRDMW11d8ZV7HvsL3vAyRjZB5npW", simd: "SIMD-0525", name: "Slot time 200ms", effectiveNextEpoch: true, source: "agave-feature-set" },
  { id: "B8JJXCy5amZyWG9r7EnUYLwzXSXTxG7GZ1qZ1qggo83g", simd: "SIMD-0500", name: "Disable deployment of SBPF v0/v1/v2", source: "agave-feature-set" },
  { id: "A1pengvuM6JEcyNuTnMqepBKhwHE3N6PmUrdATGawhJS", simd: "SIMD-0326", name: "Alpenglow consensus", source: "agave-feature-set" },
];

export const FEATURE_PROGRAM_ID = "Feature111111111111111111111111111111111111";

export type GateState =
  | { state: "active"; activatedAt: number }
  | { state: "pending" }
  | { state: "absent" }
  | { state: "invalid"; reason: string };

/**
 * Decode a feature account (bincode `Feature { activated_at: Option<u64> }`).
 */
export function decodeFeatureAccount(account: null | { owner: string; data: [string, string] | string }): GateState {
  if (!account) return { state: "absent" };
  if (account.owner !== FEATURE_PROGRAM_ID) return { state: "invalid", reason: `owner ${account.owner}` };
  const b64 = Array.isArray(account.data) ? account.data[0] : account.data;
  const buf = Buffer.from(b64, "base64");
  if (buf.length < 1) return { state: "invalid", reason: "empty data" };
  if (buf[0] === 0) return { state: "pending" };
  if (buf[0] !== 1 || buf.length < 9) return { state: "invalid", reason: "bad encoding" };
  return { state: "active", activatedAt: Number(buf.readBigUInt64LE(1)) };
}

export interface EpochSchedule {
  slotsPerEpoch: number;
  firstNormalEpoch: number;
  firstNormalSlot: number;
}

export function epochOfSlot(slot: number, s: EpochSchedule): number {
  if (slot < s.firstNormalSlot) {
    // warmup epochs double in length starting at 32 slots; good enough for old slots
    let epoch = 0;
    let len = 32;
    let start = 0;
    while (start + len <= slot) {
      start += len;
      len *= 2;
      epoch++;
    }
    return epoch;
  }
  return s.firstNormalEpoch + Math.floor((slot - s.firstNormalSlot) / s.slotsPerEpoch);
}

export function firstSlotOfEpoch(epoch: number, s: EpochSchedule): number {
  return s.firstNormalSlot + (epoch - s.firstNormalEpoch) * s.slotsPerEpoch;
}
