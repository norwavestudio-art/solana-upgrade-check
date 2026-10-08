import { jsonTester, rule } from "./helpers.mjs";

const pkg = (deps, field = "dependencies") => JSON.stringify({ name: "x", [field]: deps }, null, 2);

jsonTester.run("min-v1-sdk-version", rule("min-v1-sdk-version"), {
  valid: [
    { filename: "package.json", code: pkg({ "@solana/web3.js": "^1.99.0", "@solana/kit": "^8.4.0" }) },
    { filename: "package.json", code: pkg({ "@solana/web3.js": "3.0.2" }) },
    { filename: "package.json", code: pkg({ "@solana/web3.js": "workspace:*" }) },
    { filename: "package.json", code: pkg({ "@solana/web3.js": "^1.0.0" }, "peerDependencies") },
    { filename: "other.json", code: pkg({ "@solana/web3.js": "^1.0.0" }) },
    { filename: "package.json", code: pkg({ "left-pad": "^1.0.0" }) },
  ],
  invalid: [
    {
      filename: "package.json",
      code: pkg({ "@solana/web3.js": "^1.95.4" }),
      output: pkg({ "@solana/web3.js": "^1.99.0" }),
      errors: [{ messageId: "tooOld" }],
    },
    {
      filename: "package.json",
      code: pkg({ "@solana/web3.js": "~1.87.6" }, "devDependencies"),
      output: pkg({ "@solana/web3.js": "~1.99.0" }, "devDependencies"),
      errors: [{ messageId: "tooOld" }],
    },
    {
      // major bump: no autofix
      filename: "package.json",
      code: pkg({ "@solana/kit": "^6.1.0" }),
      output: null,
      errors: [{ messageId: "tooOld", data: { name: "@solana/kit", range: "^6.1.0", min: "8.0.0", note: "read and send v1" } }],
    },
    {
      filename: "package.json",
      code: pkg({ "@solana/web3.js": "^2.0.0" }),
      output: null,
      errors: [{ messageId: "noSupport" }],
    },
    {
      filename: "package.json",
      code: pkg({ "@solana/web3.js": "3.0.0" }),
      output: pkg({ "@solana/web3.js": "3.0.2" }),
      errors: [{ messageId: "tooOld" }],
    },
    {
      filename: "package.json",
      code: pkg({ "@solana/web3.js": ">=1.70.0 <2" }),
      output: null,
      errors: [{ messageId: "tooOld" }],
    },
    {
      filename: "package.json",
      code: pkg({ "@solana/wallet-standard-features": "^1.2.0" }),
      output: pkg({ "@solana/wallet-standard-features": "^1.5.0" }),
      errors: [{ messageId: "tooOld" }],
    },
    {
      filename: "package.json",
      code: pkg({ "@solana/web3.js": "^1.0.0" }, "peerDependencies"),
      options: [{ includePeer: true }],
      output: pkg({ "@solana/web3.js": "^1.99.0" }, "peerDependencies"),
      errors: [{ messageId: "tooOld" }],
    },
  ],
});

jsonTester.run("min-sns-sdk-version", rule("min-sns-sdk-version"), {
  valid: [
    { filename: "package.json", code: pkg({ "@bonfida/spl-name-service": "^4.0.1" }) },
    { filename: "package.json", code: pkg({ "@solana-name-service/sns-sdk-kit": "^1.0.1" }) },
  ],
  invalid: [
    {
      filename: "package.json",
      code: pkg({ "@bonfida/spl-name-service": "^3.0.10" }),
      output: null,
      errors: [{ messageId: "tooOld" }],
    },
    {
      filename: "/repo/apps/web/package.json",
      code: pkg({ "@solana-name-service/sns-sdk-kit": "0.10.1" }),
      output: null,
      errors: [{ messageId: "tooOld" }],
    },
  ],
});
