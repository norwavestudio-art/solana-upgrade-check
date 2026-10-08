import type { Finding } from "./cli.js";
import { PLUGIN_NAME } from "./index.js";

/** Minimal SARIF 2.1.0 log for GitHub code scanning. */
export function toSarif(findings: Finding[], rules: Record<string, any>, version: string) {
  const ruleIds = Object.keys(rules).map((r) => `${PLUGIN_NAME}/${r}`);
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "solana-upgrade-check",
            version,
            rules: Object.entries(rules).map(([name, r]) => ({
              id: `${PLUGIN_NAME}/${name}`,
              shortDescription: { text: r.meta.docs.description },
              helpUri: r.meta.docs.url,
              defaultConfiguration: { level: name.startsWith("min-") ? "error" : "warning" },
            })),
          },
        },
        results: findings.map((f) => ({
          ruleId: f.ruleId,
          ruleIndex: ruleIds.indexOf(f.ruleId),
          level: f.severity,
          message: { text: f.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: f.file },
                region: {
                  startLine: f.line,
                  startColumn: f.column,
                  ...(f.endLine ? { endLine: f.endLine } : {}),
                  ...(f.endColumn ? { endColumn: f.endColumn } : {}),
                },
              },
            },
          ],
        })),
      },
    ],
  };
}
