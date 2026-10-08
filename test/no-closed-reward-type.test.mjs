import { tsTester, rule } from "./helpers.mjs";

const name = "no-closed-reward-type";

tsTester.run(name, rule(name), {
  valid: [
    `switch (r.rewardType) { case "Fee": a(); break; default: other(); }`,
    `switch (r.rewardType) { case "Fee": break; case "DeactivatedStake": break; }`,
    `type RewardType = "Fee" | "Rent" | "Staking" | "Voting" | "DeactivatedStake" | "VATDebit";`,
    `type T = "Fee" | "Rent";`,
    `switch (r.kind) { case "Fee": break; case "Rent": break; }`,
    `enum RewardType { Fee = "Fee", Rent = "Rent", Staking = "Staking", Voting = "Voting", DeactivatedStake = "DeactivatedStake" }`,
  ],
  invalid: [
    {
      code: `switch (reward.rewardType) {\ncase "Fee": fees += l; break;\ncase "Voting": votes += l; break;\n}`,
      errors: [
        {
          messageId: "closedSwitch",
          suggestions: [
            {
              messageId: "addDefault",
              output: `switch (reward.rewardType) {\ncase "Fee": fees += l; break;\ncase "Voting": votes += l; break;\n  default:\n    // DeactivatedStake, VATDebit and future reward types\n    break;\n}`,
            },
          ],
        },
      ],
    },
    {
      code: `interface Reward { rewardType: "Fee" | "Rent" | "Staking" | "Voting" | null }`,
      errors: [
        {
          messageId: "closedUnion",
          suggestions: [
            { messageId: "addMembers", output: `interface Reward { rewardType: "Fee" | "Rent" | "Staking" | "Voting" | null | "DeactivatedStake" | "VATDebit" }` },
          ],
        },
      ],
    },
    {
      code: `enum RewardType { Fee = "Fee", Rent = "Rent", Staking = "Staking", Voting = "Voting" }`,
      errors: [{ messageId: "closedEnum" }],
    },
  ],
});
