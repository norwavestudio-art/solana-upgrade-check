import { tsTester, rule } from "./helpers.mjs";

const name = "no-hardcoded-slot-duration";

tsTester.run(name, rule(name), {
  valid: [
    `const status = 400;`,
    `res.status(400);`,
    `const width = height * 400;`,
    `const secs = await conn.getBlockTime(slot);`,
    `const TICKS = 160;`,
  ],
  invalid: [
    { code: `const MS_PER_SLOT = 400;`, errors: [{ messageId: "literal" }] },
    { code: `const SLOT_DURATION_MS = 400;`, errors: [{ messageId: "literal" }] },
    { code: `const slotTimeSeconds = 0.4;`, errors: [{ messageId: "literal" }] },
    { code: `const eta = (targetSlot - currentSlot) * 400;`, errors: [{ messageId: "literal" }] },
    { code: `const slotsLeft = remainingMs / 400;\nconst x = slotsLeft;`, errors: [{ messageId: "literal" }] },
    { code: `const elapsedSec = slots * 0.4;`, errors: [{ messageId: "literal" }] },
    { code: `const SLOTS_PER_SECOND = 2.5;`, errors: [{ messageId: "literal" }] },
    { code: `const NUM_TICKS_PER_SECOND = 160;`, errors: [{ messageId: "literal" }] },
    { code: `const cfg = { msPerSlot: 400 };`, errors: [{ messageId: "literal" }] },
    { code: `import { MS_PER_SLOT } from "./timing";`, errors: [{ messageId: "identifier" }] },
  ],
});
