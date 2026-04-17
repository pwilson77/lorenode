let cachedXMcpContextPromise = null;

function isEnabled(value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseToolPayload(toolResult) {
  const content = toolResult?.content || [];
  if (!Array.isArray(content) || content.length === 0) {
    return null;
  }

  for (const item of content) {
    if (item?.type === "text" && typeof item.text === "string") {
      try {
        return JSON.parse(item.text);
      } catch {
        continue;
      }
    }

    if (item?.type === "json" && item.json) {
      return item.json;
    }
  }

  return null;
}

async function getXMcpContext() {
  if (cachedXMcpContextPromise) {
    return cachedXMcpContextPromise;
  }

  cachedXMcpContextPromise = (async () => {
    if (!isEnabled(process.env.X_MCP_ENABLED)) {
      return null;
    }

    const { Client } =
      await import("@modelcontextprotocol/sdk/client/index.js");
    const { StreamableHTTPClientTransport } =
      await import("@modelcontextprotocol/sdk/client/streamableHttp.js");

    const serverUrl = new URL(
      process.env.X_MCP_URL || "http://127.0.0.1:8000/mcp",
    );
    const transport = new StreamableHTTPClientTransport(serverUrl);
    const client = new Client({
      name: "lore-node-xmcp-client",
      version: "0.1.0",
    });

    await client.connect(transport);
    return { client, transport };
  })().catch((error) => {
    console.warn(
      "X MCP initialization failed:",
      error?.message || String(error),
    );
    return null;
  });

  return cachedXMcpContextPromise;
}

export async function searchRecentPostsViaXMcp({ query, maxResults = 10 }) {
  try {
    const context = await getXMcpContext();
    if (!context) {
      return null;
    }

    const boundedMaxResults = Math.max(10, Math.min(100, Number(maxResults) || 10));

    const { client } = context;
    const result = await client.callTool({
      name: "searchPostsRecent",
      arguments: {
        query,
        max_results: boundedMaxResults,
        "tweet.fields": ["created_at", "public_metrics", "lang"],
        expansions: ["author_id"],
        "user.fields": ["username", "verified", "public_metrics", "created_at"],
      },
    });

    return parseToolPayload(result);
  } catch (error) {
    console.warn(
      "X MCP recent search failed:",
      error?.message || String(error),
    );
    return null;
  }
}
