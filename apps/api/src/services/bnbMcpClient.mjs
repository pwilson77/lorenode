let cachedMcpContextPromise = null;

function parseToolText(toolResult) {
  const text = toolResult?.content?.[0]?.text;
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function getMcpContext() {
  if (cachedMcpContextPromise) {
    return cachedMcpContextPromise;
  }

  cachedMcpContextPromise = (async () => {
    if (process.env.BNBCHAIN_MCP_ENABLED !== "true") {
      return null;
    }

    const { Client } =
      await import("@modelcontextprotocol/sdk/client/index.js");
    const { StdioClientTransport } =
      await import("@modelcontextprotocol/sdk/client/stdio.js");

    const command = process.env.BNBCHAIN_MCP_COMMAND || "npx";
    const args = process.env.BNBCHAIN_MCP_ARGS
      ? process.env.BNBCHAIN_MCP_ARGS.split(" ").filter(Boolean)
      : ["-y", "@bnb-chain/mcp@latest"];

    const transport = new StdioClientTransport({
      command,
      args,
      env: {
        ...process.env,
        PRIVATE_KEY: "",
        BNBCHAIN_MCP_SKIP_TRANSFER_CONFIRMATION: "false",
      },
    });

    const client = new Client({
      name: "lore-node-mcp-client",
      version: "0.1.0",
    });

    await client.connect(transport);
    return { client, transport };
  })().catch((error) => {
    console.warn(
      "BNB MCP initialization failed:",
      error?.message || String(error),
    );
    return null;
  });

  return cachedMcpContextPromise;
}

export async function fetchTokenMetadataFromBnbMcp(ca, network = "bsc") {
  try {
    const context = await getMcpContext();
    if (!context) {
      return null;
    }

    const { client } = context;

    const contractCheck = await client.callTool({
      name: "is_contract",
      arguments: {
        address: ca,
        network,
      },
    });

    const contractData = parseToolText(contractCheck);
    if (!contractData?.isContract) {
      return null;
    }

    const tokenInfoRes = await client.callTool({
      name: "get_erc20_token_info",
      arguments: {
        tokenAddress: ca,
        network,
      },
    });

    const tokenInfo = parseToolText(tokenInfoRes);
    if (!tokenInfo?.name || !tokenInfo?.symbol) {
      return null;
    }

    return {
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      decimals: tokenInfo.decimals ?? null,
      total_supply: tokenInfo.formattedTotalSupply ?? null,
      source: "bnbchain-mcp",
    };
  } catch (error) {
    console.warn(
      "BNB MCP token fetch failed:",
      error?.message || String(error),
    );
    return null;
  }
}
