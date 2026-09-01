import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runAnalysis } from "@/lib/analysis";

export const ANALYZE_REPO_TOOL_NAME = "analyze-repo";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "repopulse-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    ANALYZE_REPO_TOOL_NAME,
    {
      title: "Analyze Repository Health",
      description:
        "Analyze a public GitHub repository URL: fetches the last 100 commits, computes a deterministic 0-100 health score (hygiene, churn, cadence, diversity, anomalies), and returns full metrics, tier distribution, and anomaly flags.",
      inputSchema: {
        repoUrl: z
          .string()
          .describe(
            "GitHub repository URL, e.g. https://github.com/owner/repo"
          ),
        githubToken: z
          .string()
          .optional()
          .describe(
            "Optional GitHub token to raise the API rate limit from 60 to 5,000 req/h"
          ),
      },
    },
    async ({ repoUrl, githubToken }) => {
      const outcome = await runAnalysis({ repoUrl, githubToken });

      if (!outcome.ok) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: outcome.error }, null, 2),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(outcome.data, null, 2),
          },
        ],
      };
    }
  );

  return server;
}
