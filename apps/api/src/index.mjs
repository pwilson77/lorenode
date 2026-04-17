import http from "node:http";
import { buildCultureCardPayload } from "./services/buildCultureCard.mjs";

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON payload"));
      }
    });

    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "lore-node-api",
      ts: new Date().toISOString(),
    });
  }

  if (req.method === "POST" && req.url === "/v1/narrative/culture-card") {
    try {
      const body = await readJsonBody(req);

      if (!body.ca || !body.chain_id) {
        return sendJson(res, 400, {
          error: "Missing required fields",
          required: ["ca", "chain_id"],
        });
      }

      const payload = await buildCultureCardPayload(body);
      return sendJson(res, 200, payload);
    } catch (error) {
      return sendJson(res, 400, {
        error: error.message || "Request failed",
      });
    }
  }

  return sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`LoreNode API listening on http://localhost:${PORT}`);
});
