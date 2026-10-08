import { tsTester, rule, SNS } from "./helpers.mjs";

const name = "no-hardcoded-sol-suffix";

tsTester.run(name, rule(name), {
  valid: [
    // Solidity file names in non-SNS code
    "const file = `${contractName}.sol`;",
    `const p = name + ".sol";`,
    SNS + "const shown = `${domain}.sns`;",
    `const s = "solana";`,
    `if (path.endsWith(".sol")) compileSolidity(path);`,
    "const css = `${domain}.solid`;",
  ],
  invalid: [
    {
      code: SNS + "const shown = `${domain}.sol`;",
      output: SNS + "const shown = `${domain}.sns`;",
      errors: [{ messageId: "suffix" }],
    },
    {
      code: SNS + "const label = `${primary.reverse}.sol (primary)`;",
      output: SNS + "const label = `${primary.reverse}.sns (primary)`;",
      errors: [{ messageId: "suffix" }],
    },
    {
      code: SNS + `const shown = name + ".sol";`,
      output: SNS + `const shown = name + ".sns";`,
      errors: [{ messageId: "suffix" }],
    },
    {
      // not an SNS file, but clearly a domain: suggestion only
      code: "const shown = `${domain}.sol`;",
      output: null,
      errors: [{ messageId: "suffix", suggestions: [{ messageId: "toSns", output: "const shown = `${domain}.sns`;" }] }],
    },
    {
      code: SNS + `const owner = await resolve(connection, "bonfida.sol");`,
      output: null,
      errors: [{ messageId: "literal", suggestions: [{ messageId: "toSns", output: SNS + `const owner = await resolve(connection, "bonfida.sns");` }] }],
    },
    {
      code: `const owner = await resolveDomain(rpc, "toly.sol");`,
      output: null,
      errors: [{ messageId: "literal", suggestions: [{ messageId: "toSns", output: `const owner = await resolveDomain(rpc, "toly.sns");` }] }],
    },
    {
      code: `if (domainName.endsWith(".sol")) {}`,
      output: null,
      errors: [{ messageId: "check" }],
    },
    {
      code: `const isSns = /\\.sol$/.test(domain);`,
      output: null,
      errors: [{ messageId: "check" }],
    },
  ],
});
