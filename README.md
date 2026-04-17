# LoreNode

LoreNode is a cultural-intelligence agent for the Four.meme ecosystem.

The product direction is intentionally not a generic risk engine or trading copilot. LoreNode is being built as a meme genealogy and narrative intelligence layer that explains where a token comes from, what cultural branch it belongs to, how original it is, and why it is spreading.

## Product Direction

- Meme genealogy: map a token into a recognizable meme family and identify likely ancestors, branches, and remix patterns.
- Originality detection: distinguish original launches from lazy clones, copied narratives, and creator reskins.
- Narrative spread intelligence: track how a meme propagates across X, Telegram, and launch activity instead of only producing a bullish or bearish score.
- Cross-lingual cultural translation: explain how the same token narrative is framed across English and Chinese communities.
- Shareable culture cards: turn the above into a concise, visual artifact that communities can understand and share.

## What is implemented

- A standalone API service in `apps/api` with:
  - `POST /v1/narrative/culture-card`
  - LLM-powered lore generation via OpenRouter API (with deterministic fallback)
  - Optional read-only token enrichment via bnbchain-mcp
  - BSC token metadata fetching from BscScan and CoinGecko
  - Evidence-based social intake from X and Telegram when credentials are configured
  - Genealogy classification + lore + viral score generation
  - Explainability fields for score transparency
- A TypeScript React web app in `apps/web` for running and viewing Culture Cards against the local API.

## Project layout

- `apps/api`: Node HTTP API service (no external runtime dependencies)
  - `src/services/lore.mjs`: OpenRouter-powered Cultural Historian summarizer
  - `src/services/bnbMcpClient.mjs`: Optional read-only bnbchain-mcp adapter
  - `src/services/buildCultureCard.mjs`: Pipeline orchestrator with BSC metadata fetching
  - `src/services/genealogy.mjs`: Meme family classification
  - `src/services/socialProof.mjs`: Influencer proof aggregation
  - `src/services/viral.mjs`: Viral score computation
- `apps/web`: TypeScript React UI (Vite) and typed Culture Card components
- `dependencies/mcp-servers`: local MCP server dependencies for development
  - `xmcp`: official X MCP server clone
  - `telegram-mcp`: Telegram MCP server clone
  - `start-xmcp.sh`: helper script for starting XMCP with its local venv
  - `start-telegram-mcp.sh`: helper script for starting telegram-mcp with its local venv
- `docs`: Implementation notes and contracts

## Environment Variables

Create a `.env` file in `apps/api/` with:

```bash
# LLM Configuration (OpenRouter)
OPENROUTER_API_KEY=or_your_key_here
# Optional model override
# OPENROUTER_MODEL=openai/gpt-4o-mini
# Optional attribution headers
# OPENROUTER_SITE_URL=https://your-app.example
# OPENROUTER_APP_NAME=LoreNode

# Optional: bnbchain-mcp read-only enrichment
# Requires MCP SDK dependency + local or accessible command
# Set true to enable MCP token lookup before BscScan/CoinGecko
# BNBCHAIN_MCP_ENABLED=true
# Optional command override (defaults to npx)
# BNBCHAIN_MCP_COMMAND=npx
# Optional args override (defaults to '-y @bnb-chain/mcp@latest')
# BNBCHAIN_MCP_ARGS=-y @bnb-chain/mcp@latest

# BSC Token Metadata (optional but recommended)
BSCSCAN_API_KEY=your_bscscan_key_here

# CoinGecko (no key required, but optional for higher rate limits)
# COINGECKO_API_KEY=optional

# X API (optional, enables Phase 3 live social evidence)
# TWITTER_BEARER_TOKEN=optional_for_social_phase
# X_BEARER_TOKEN=optional_alias_for_social_phase

# Optional: X MCP integration (preferred when running XMCP locally)
# X_MCP_ENABLED=true
# X_MCP_URL=http://127.0.0.1:8000/mcp
# XMCP is the official X MCP server: https://docs.x.com/tools/mcp

# Telegram Bot API (optional, enables Phase 3 channel/group evidence)
# Bot must be present in the monitored chat/channel to receive updates.
# TELEGRAM_BOT_TOKEN=optional_for_social_phase
# TELEGRAM_SOURCE_CHATS=fourmeme_alpha,fourmeme_cn

# Optional: Telegram MCP integration (preferred for richer read-only search)
# Requires a local telegram-mcp server checkout and Telegram credentials.
# TELEGRAM_MCP_ENABLED=true
# TELEGRAM_MCP_COMMAND=uv
# TELEGRAM_MCP_ARGS=--directory /absolute/path/to/telegram-mcp run main.py
# If `uv` is not installed, you can use:
# TELEGRAM_MCP_COMMAND=python3
# TELEGRAM_MCP_ARGS=/absolute/path/to/telegram-mcp/main.py
# TELEGRAM_API_ID=your_telegram_api_id
# TELEGRAM_API_HASH=your_telegram_api_hash
# TELEGRAM_SESSION_STRING=your_telegram_session_string
```

## Run the API

```bash
cd apps/api
node src/index.mjs
```

The API listens on `http://localhost:8787`.

## Run the Web UI (TypeScript)

```bash
cd apps/web
npm install
npm run dev
```

The web app runs on `http://localhost:5173` and proxies `/api/*` requests to the local API at `http://127.0.0.1:8787`.

## Docker Deployment

Build and run the web UI plus API:

```bash
docker compose up --build
```

This starts:

- `web` on `http://localhost:5173`
- `api` on `http://localhost:8787`

To also start the X MCP sidecar:

```bash
docker compose --profile social up --build
```

Notes:

- `apps/api/.env` is loaded into the API container via `env_file`.
- `dependencies/mcp-servers/xmcp/.env` is loaded into the XMCP container when the `social` profile is enabled.
- Telegram MCP is launched by the API container through the local wrapper script and uses the mounted `dependencies/mcp-servers/telegram-mcp/.env` file.
- Telegram session state is persisted in a named Docker volume.

## Test the endpoint

```bash
# With real BSC token (will fetch real metadata if BSCSCAN_API_KEY is set)
curl -X POST http://localhost:8787/v1/narrative/culture-card \
  -H "content-type: application/json" \
  -d '{"ca":"0x2170Ed0880ac9A755fd29B2688956BD959F933F8","chain_id":"bsc"}'

# Or with mock CA (falls back to synthetic data)
curl -X POST http://localhost:8787/v1/narrative/culture-card \
  -H "content-type: application/json" \
  -d '{"ca":"0xabc123def456","chain_id":"bsc"}'
```

## Response Schema

The endpoint returns a `CultureCardResponse` with:

- `token`: Real or synthetic metadata for the contract
- `genealogy`: Meme family classification + confidence
- `genealogy.launch_classification`: Original launch type (`original-launch`, `remix`, `revival`, `low-effort-derivative`)
- `genealogy.originality`: Originality score, clone probability, creator-reuse signal, and heuristic breakdown
- `lore`: 2-sentence origin story (LLM-generated or templated)
- `viral_scorecard`: Momentum, social proof, narrative cohesion, anti-gaming penalty
- `influencer_map`: Top pushers + authenticity scores
- `influencer_map.evidence_refs`: Evidence links from X / Telegram when available
- `influencer_map.source_stats`: Source-level mention counts and ingestion provenance
- `freshness`: Computed timestamp and data freshness metadata
- `share`: Pre-rendered theme and aspect ratio for UI
- `meta`: Schema version and request ID

## Implementation Phases

### Phase 1: LLM Summarizer ✅

- OpenRouter API integration for Cultural Historian
- Fallback to deterministic template if API fails or no key
- Includes `llm_used` flag in response

### Phase 2: BSC Token Metadata ✅

- BscScan API for contract source and metadata
- CoinGecko API for price and market cap context
- Graceful fallback to mock token data

### Phase 3: Evidence-Based Social Intake ✅

- Optional XMCP read-only path for recent-post search using X's official MCP server
- Optional telegram-mcp read-only path for richer Telegram message discovery
- X recent-search ingestion when a bearer token is configured
- Telegram Bot API ingestion from configured chats/channels
- Evidence-backed source snippets instead of synthetic social proof
- Deterministic fallback when social credentials are absent
- Social evidence is now threaded into `influencer_map` and `meta.social_data_source`
- Source diagnostics now distinguish successful zero-result searches from integration failures

### Phase 4: Originality + Genealogy Upgrade ✅

- Added evidence-backed deterministic lineage scoring using motif/family and source-behavior signals
- Added clone-risk heuristics across naming hints, concentration, account diversity, and creator reuse signal
- Added originality score and ancestry confidence to API response
- Added launch-type classification (`original-launch`, `remix`, `revival`, `low-effort-derivative`)

### Phase 5: Cross-Lingual Narrative Intelligence (Planned)

- Compare English and Chinese framings of the same token
- Identify narrative drift between communities
- Generate short "what EN sees vs what CN sees" summaries

### Phase 6: UI Flow (In Progress)

- TypeScript React page with CA + chain input
- Loading/error states for API calls
- Live Culture Card rendering from API response
- Local API proxy wiring for dev workflow
- Share/export workflow remains pending

### Phase 8: Containerized Deployment ✅

- Dockerized API service
- Dockerized TypeScript web frontend
- Optional XMCP sidecar service for local deployment
- Compose-based orchestration for easy local deployment

### Phase 7: Image Export (Planned)

- Vercel OG Image for PNG generation
- Social-ready culture card export

## Next Steps

1. **Exercise Phase 3 with real credentials** and validate X/Telegram evidence against live tokens.
2. **Upgrade genealogy into originality intelligence** with clone detection, creator reuse checks, and ancestry confidence.
3. **Add cross-lingual narrative summaries** so LoreNode can compare EN and CN meme framing on Four.meme.
4. **Wire the frontend** around lineage, originality, and spread evidence rather than generic token analytics.
5. **Add image export** via Vercel OG or similar service for shareable culture cards.

## Testing Live Social Sources

### Default fallback test

With no X or Telegram credentials set, LoreNode should still return a valid payload and report synthetic fallback:

```bash
cd apps/api
node --input-type=module -e "import { buildCultureCardPayload } from './src/services/buildCultureCard.mjs'; const payload = await buildCultureCardPayload({ ca: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', chain_id: 'bsc' }); console.log(JSON.stringify({ social_data_source: payload.meta.social_data_source, top_pushers: payload.influencer_map.top_pushers.length }, null, 2));"
```

Expected:

- `social_data_source` is `synthetic-fallback`
- payload still includes populated `influencer_map.top_pushers`

### X MCP test

1. Clone and run XMCP locally following https://docs.x.com/tools/mcp
2. Set:

- `X_MCP_ENABLED=true`
- `X_MCP_URL=http://127.0.0.1:8000/mcp`

3. Re-run the payload builder or API request.

Expected:

- `meta.social_data_source` contains `xmcp` if search succeeded
- `influencer_map.evidence_refs` contains `https://x.com/...` links

Run via local dependency folder:

```bash
cd dependencies/mcp-servers
./start-xmcp.sh
```

### Telegram MCP test

1. Clone `https://github.com/chigwell/telegram-mcp`
2. Create Telegram credentials:

- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`
- `TELEGRAM_SESSION_STRING`

3. Set:

- `TELEGRAM_MCP_ENABLED=true`
- `TELEGRAM_MCP_COMMAND=uv`
- `TELEGRAM_MCP_ARGS=--directory /absolute/path/to/telegram-mcp run main.py`
- If `uv` is unavailable, use `TELEGRAM_MCP_COMMAND=python3` and `TELEGRAM_MCP_ARGS=/absolute/path/to/telegram-mcp/main.py`

4. Re-run the payload builder or API request.

Expected:

- `meta.social_data_source` contains `telegram-mcp` if search succeeded
- `influencer_map.evidence_refs` contains `telegram:<chat>:<messageId>` style evidence refs

Run via local dependency folder:

```bash
cd dependencies/mcp-servers
./start-telegram-mcp.sh
```

### Full endpoint test

```bash
cd apps/api
node src/index.mjs

curl -X POST http://localhost:8787/v1/narrative/culture-card \
  -H "content-type: application/json" \
  -d '{"ca":"0x2170Ed0880ac9A755fd29B2688956BD959F933F8","chain_id":"bsc"}'
```

Check:

- `meta.metadata_source`
- `meta.social_data_source`
- `influencer_map.evidence_refs`
- `influencer_map.source_stats`

## Notes for Hackathon

- LLM fallback ensures the app works even without OpenRouter key (uses deterministic templates)
- BSC metadata fetching gracefully falls back to mock data if BscScan key is missing
- All Phase 1-3 backend features are implemented with graceful fallbacks
- The next build focus is differentiation: genealogy, originality, and narrative spread, not another generic scoring dashboard
- Social evidence and cross-lingual narrative analysis are the key hackathon upgrades from here
