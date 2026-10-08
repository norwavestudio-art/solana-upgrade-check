import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeFeatureAccount, epochOfSlot, firstSlotOfEpoch, FEATURE_PROGRAM_ID, FEATURE_GATES } from "../dist/features.js";

const sched = { slotsPerEpoch: 432000, firstNormalEpoch: 0, firstNormalSlot: 0 }; // mainnet getEpochSchedule (warmup: false)

test("decodes an activated feature account (mainnet enable_tx_v1 sample)", () => {
  const st = decodeFeatureAccount({ owner: FEATURE_PROGRAM_ID, data: ["AYCCphoAAAAA", "base64"] });
  assert.deepEqual(st, { state: "active", activatedAt: 447120000 });
});

test("decodes pending / absent / foreign-owner accounts", () => {
  assert.deepEqual(decodeFeatureAccount({ owner: FEATURE_PROGRAM_ID, data: ["AA==", "base64"] }), { state: "pending" });
  assert.deepEqual(decodeFeatureAccount(null), { state: "absent" });
  assert.equal(decodeFeatureAccount({ owner: "11111111111111111111111111111111", data: ["AQ==", "base64"] }).state, "invalid");
});

test("epoch math matches mainnet (slot 454,464,000 = first slot of epoch 1052)", () => {
  assert.equal(epochOfSlot(454464000, sched), 1052);
  assert.equal(firstSlotOfEpoch(1053, sched), 454896000);
  assert.equal(epochOfSlot(447120000, sched), 1035);
});

test("feature ids are unique base58 strings", () => {
  const ids = FEATURE_GATES.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
});
