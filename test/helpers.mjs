import { describe, it } from "node:test";
import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import * as jsoncParser from "jsonc-eslint-parser";
import plugin from "../dist/index.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

export const tsTester = new RuleTester({
  languageOptions: { parser: tsParser, sourceType: "module", ecmaVersion: "latest" },
});

export const jsonTester = new RuleTester({
  languageOptions: { parser: jsoncParser },
});

export const rule = (name) => plugin.rules[name];

/** Prefix that makes a file look like Solana client code. */
export const W3 = `import { Connection } from "@solana/web3.js";\n`;
export const SNS = `import { resolve } from "@bonfida/spl-name-service";\n`;
