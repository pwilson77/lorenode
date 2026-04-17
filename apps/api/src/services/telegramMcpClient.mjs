let cachedTelegramMcpContextPromise = null;

function isEnabled(value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

async function loadEnvFile(filePath) {
  try {
    const { readFile } = await import("node:fs/promises");
    const content = await readFile(filePath, "utf8");
    const env = {};

    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (!key) {
        continue;
      }

      env[key] = value;
    }

    return env;
  } catch {
    return {};
  }
}

function getTelegramMcpWorkingDirectory(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return null;
  }

  const scriptArg = args[0];
  if (typeof scriptArg !== "string") {
    return null;
  }

  if (scriptArg.endsWith("main.py")) {
    const normalized = scriptArg.replace(/\\/g, "/");
    return normalized.slice(0, normalized.lastIndexOf("/"));
  }

  const directoryFlagIndex = args.indexOf("--directory");
  if (directoryFlagIndex !== -1 && args[directoryFlagIndex + 1]) {
    return args[directoryFlagIndex + 1];
  }

  return null;
}

async function resolveTelegramLaunch(command, args) {
  const { access } = await import("node:fs/promises");
  const path = await import("node:path");
  const pythonLike = /^python(\d+(\.\d+)?)?$/i.test(command || "");
  const scriptArg = Array.isArray(args) ? args[0] : null;

  if (pythonLike && typeof scriptArg === "string" && scriptArg.endsWith("main.py")) {
    const telegramDir = path.dirname(scriptArg);
    const wrapperPath = path.join(path.dirname(telegramDir), "start-telegram-mcp.sh");
    try {
      await access(wrapperPath);
      return { command: wrapperPath, args: [] };
    } catch {
      return { command, args };
    }
  }

  return { command, args };
}

function mergeEnvWithNonEmptyOverrides(baseEnv, overrideEnv) {
  const merged = { ...baseEnv };

  for (const [key, value] of Object.entries(overrideEnv)) {
    if (typeof value === "string" && value.trim() === "") {
      continue;
    }

    merged[key] = value;
  }

  return merged;
}

function parseJsonText(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseSearchGlobalText(text) {
  if (!text || typeof text !== "string") {
    return [];
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("No messages found"));

  return lines.map((line) => {
    const chatMatch = line.match(/Chat:\s*(.*?)\s*\|\s*ID:/);
    const idMatch = line.match(/\|\s*ID:\s*(\d+)/);
    const dateMatch = line.match(/\|\s*Date:\s*([^|]+?)(?:\s*\|\s*Message:|$)/);
    const messageMatch = line.match(/\|\s*Message:\s*(.*)$/);
    const prefix = chatMatch ? line.slice(0, chatMatch.index) : line;
    const senderParts = prefix
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    const sender =
      senderParts.length > 0 ? senderParts[senderParts.length - 1] : null;

    return {
      chat_name: chatMatch?.[1]?.trim() || "telegram-channel",
      message_id: idMatch ? Number(idMatch[1]) : null,
      sender_name: sender,
      date: dateMatch?.[1]?.trim() || null,
      message: messageMatch?.[1]?.trim() || "",
    };
  });
}

function parseToolPayload(toolResult) {
  const content = toolResult?.content || [];
  if (!Array.isArray(content) || content.length === 0) {
    return null;
  }

  for (const item of content) {
    if (item?.type === "json" && item.json) {
      return item.json;
    }

    if (item?.type === "text" && typeof item.text === "string") {
      const jsonPayload = parseJsonText(item.text);
      if (jsonPayload) {
        return jsonPayload;
      }

      return parseSearchGlobalText(item.text);
    }
  }

  return null;
}

async function getTelegramMcpContext() {
  if (cachedTelegramMcpContextPromise) {
    return cachedTelegramMcpContextPromise;
  }

  cachedTelegramMcpContextPromise = (async () => {
    if (!isEnabled(process.env.TELEGRAM_MCP_ENABLED)) {
      return null;
    }

    const { Client } =
      await import("@modelcontextprotocol/sdk/client/index.js");
    const { StdioClientTransport } =
      await import("@modelcontextprotocol/sdk/client/stdio.js");

    const command = process.env.TELEGRAM_MCP_COMMAND || "uv";
    const args = process.env.TELEGRAM_MCP_ARGS
      ? process.env.TELEGRAM_MCP_ARGS.split(" ").filter(Boolean)
      : ["run", "main.py"];
    const launch = await resolveTelegramLaunch(command, args);
    const workingDirectory = getTelegramMcpWorkingDirectory(args);
    const serverEnvFile = workingDirectory ? `${workingDirectory}/.env` : null;
    const serverEnv = serverEnvFile ? await loadEnvFile(serverEnvFile) : {};

    const transport = new StdioClientTransport({
      command: launch.command,
      args: launch.args,
      env: mergeEnvWithNonEmptyOverrides(serverEnv, process.env),
    });

    const client = new Client({
      name: "lore-node-telegram-mcp-client",
      version: "0.1.0",
    });

    await client.connect(transport);
    return { client, transport };
  })().catch((error) => {
    console.warn(
      "Telegram MCP initialization failed:",
      error?.message || String(error),
    );
    return null;
  });

  return cachedTelegramMcpContextPromise;
}

export async function searchGlobalMessagesViaTelegramMcp({
  query,
  pageSize = 20,
}) {
  try {
    const context = await getTelegramMcpContext();
    if (!context) {
      return null;
    }

    const { client } = context;
    const result = await client.callTool({
      name: "search_global",
      arguments: {
        query,
        page: 1,
        page_size: pageSize,
      },
    });

    return parseToolPayload(result);
  } catch (error) {
    console.warn(
      "Telegram MCP global search failed:",
      error?.message || String(error),
    );
    return null;
  }
}
