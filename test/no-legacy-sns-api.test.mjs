import { tsTester, rule } from "./helpers.mjs";

const name = "no-legacy-sns-api";

tsTester.run(name, rule(name), {
  valid: [
    `import { getPrimaryDomain, resolve } from "@bonfida/spl-name-service";`,
    `import { getSnsDomainsForAddress } from "@solana-name-service/sns-sdk-kit";`,
    `import { getFavoriteDomain } from "./my-local-helpers";`,
  ],
  invalid: [
    {
      code: `import { getFavoriteDomain } from "@bonfida/spl-name-service";\nconst d = await getFavoriteDomain(connection, wallet);`,
      output: null,
      errors: [
        {
          messageId: "renamed",
          suggestions: [
            {
              messageId: "rename",
              output: `import { getPrimaryDomain } from "@bonfida/spl-name-service";\nconst d = await getPrimaryDomain(connection, wallet);`,
            },
          ],
        },
      ],
    },
    {
      code: `import { getFavoriteDomain as fav } from "@bonfida/spl-name-service";\nfav(c, w);`,
      output: null,
      errors: [
        {
          messageId: "renamed",
          suggestions: [{ messageId: "rename", output: `import { getPrimaryDomain as fav } from "@bonfida/spl-name-service";\nfav(c, w);` }],
        },
      ],
    },
    {
      code: `import { resolveDomain, getDomainsForAddress } from "@solana-name-service/sns-sdk-kit";`,
      output: null,
      errors: [
        {
          messageId: "renamed",
          data: { from: "resolveDomain", to: "resolve", pkg: "@solana-name-service/sns-sdk-kit", note: " — pass a full `.sns` name" },
          suggestions: [{ messageId: "rename", output: `import { resolve, getDomainsForAddress } from "@solana-name-service/sns-sdk-kit";` }],
        },
        {
          messageId: "renamed",
          suggestions: [{ messageId: "rename", output: `import { resolveDomain, getSnsDomainsForAddress } from "@solana-name-service/sns-sdk-kit";` }],
        },
      ],
    },
  ],
});
