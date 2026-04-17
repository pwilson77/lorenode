FROM node:22-bookworm-slim

WORKDIR /workspace

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv python3-pip bash ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY apps/api/package*.json /workspace/apps/api/
RUN cd /workspace/apps/api && npm ci

COPY apps/api /workspace/apps/api
COPY dependencies/mcp-servers /workspace/dependencies/mcp-servers

WORKDIR /workspace/apps/api

EXPOSE 8787

CMD ["npm", "start"]
