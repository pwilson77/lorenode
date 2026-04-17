# LoreNode MVP Implementation Progress

## Strategic Update

The roadmap has been tightened around LoreNode's strongest differentiation: cultural intelligence for meme tokens.

What we are not building:

- Another generic risk-scoring dashboard
- Another trading copilot
- Another launch assistant

What we are building next:

- Meme genealogy and lineage detection
- Originality and clone detection
- Evidence-backed narrative spread tracking across X and Telegram
- Cross-lingual EN/CN narrative translation for Four.meme communities

## Completed

### Phase 1: LLM Cultural Historian ✅

- Integrated OpenRouter API (openai/gpt-4o-mini route) for 2-sentence lore generation
- System prompt enforces evidence-grounded narratives, no hallucination
- Graceful fallback to deterministic template if API fails or no key
- Response includes `llm_used` flag for transparency
- File: `apps/api/src/services/lore.mjs`

### Phase 2: BSC Token Metadata ✅

- BscScan API integration for real contract metadata (name, creation block, source)
- CoinGecko API integration for price, market cap, logo context
- Fallback to synthetic token creation if APIs fail
- Improves genealogy confidence by using real token symbols
- File: `apps/api/src/services/buildCultureCard.mjs`

### Phase 3: Evidence-Based Social Intake ✅

- Added optional XMCP integration for read-only X search via the official X MCP server
- Added optional telegram-mcp integration for read-only Telegram global search
- Added async X recent-search ingestion using bearer-token auth when configured
- Added Telegram Bot API ingestion using `getUpdates` and optional chat allowlist filtering
- Social evidence now returns evidence links, mention counts, unique-account counts, and source provenance
- Deterministic fallback remains in place when social credentials are not present
- Files: `apps/api/src/services/socialProof.mjs`, `apps/api/src/services/xMcpClient.mjs`, `apps/api/src/services/telegramMcpClient.mjs`, `apps/api/src/services/buildCultureCard.mjs`

### Core API Pipeline ✅

- Async/await support throughout
- Error handling with fallbacks at every step
- Full end-to-end payload generation working
- Tested with real BSC token CAs

## In Progress / Next Steps

### Phase 3: Evidence-Based Social Intake (Implemented)

Requirements:

- X (Twitter) API v2 for recent mentions of token CA
  - Requires: `TWITTER_BEARER_TOKEN` or equivalent bearer-token env var
  - Rate: 300 requests/15min (basic tier)
- Telegram Bot API for group monitoring
- Store evidence snippets, account handles, timestamps, and post URLs when available
- Replace synthetic influencer proof with traceable source evidence

Implementation:

- Add narrative extraction, mention clustering, and account reuse detection
- Integrate into pipeline as async service

### Phase 4: Originality + Genealogy Upgrade (4-6 hours)

Requirements:

- Detect likely clone launches using symbol/name similarity, slogan overlap, motif reuse, and creator reuse
- Distinguish original launch, remix, revival, and clone behavior
- Produce ancestry confidence from evidence, not only deterministic hashing

Implementation:

- Expand `apps/api/src/services/genealogy.mjs`
- Add supporting comparison helpers for names, slogans, motifs, and issuer behavior
- Extend response schema with `originality_score`, `lineage_type`, and evidence references

### Phase 5: Cross-Lingual Narrative Intelligence (3-5 hours)

Requirements:

- Compare English and Chinese discussions for the same token
- Summarize narrative overlap and drift
- Highlight when a meme is being framed differently across communities

Implementation:

- Add a translation/comparison layer inside lore generation or a dedicated service
- Extend API response with bilingual framing summary

### Phase 6: Frontend UI Flow (3-4 hours)

Requirements:

- CultureCardPage.tsx with CA input form
- Loading state management
- Error handling and retry logic
- Share actions (copy link, export caption)
- Dedicated UI sections for lineage, originality, and spread evidence

Implementation:

- New file: `apps/web/src/pages/CultureCardPage.tsx` (or App.tsx for Vite)
- API client hook for fetching culture cards
- Connect to React/Tailwind component system
- Mobile-first responsive layout

### Phase 7: Image Export (2-3 hours)

Options:

1. **Vercel OG Image** (recommended for hackathon)
   - Built-in if using Next.js
   - Serverless PNG generation
   - Free tier included

2. **Playwright** (more control, self-hosted)
   - Headless browser screenshot
   - More infrastructure needed

### Phase 8: Persistence & Scale (Optional)

- SQLite via Prisma (like Polymarket agent pattern)
- Store past culture cards for history
- Track trending tokens
- Rate limiting and caching

## Current Architecture

```
Request: POST /v1/narrative/culture-card
  ↓
1. Fetch BSC metadata (BscScan + CoinGecko) [Phase 2 ✅]
  ↓
2. Ingest narrative evidence from X + Telegram [Phase 3 next]
  ↓
3. Build genealogy + originality view [Phase 4 next]
  ↓
4. Generate lore + cross-lingual framing summary [Phase 1 ✅, Phase 5 next]
  ↓
5. Compute viral score with evidence inputs
  ↓
6. Return unified CultureCardResponse
```

## API Keys Needed

| Service     | Required | Free Tier          | Used In    |
| ----------- | -------- | ------------------ | ---------- |
| OpenRouter  | Optional | Depends on account | Phase 1 ✅ |
| BscScan     | Optional | 5 calls/sec        | Phase 2 ✅ |
| CoinGecko   | No       | Unlimited          | Phase 2 ✅ |
| X (Twitter) | Optional | 300 req/15min      | Phase 3 ✅ |
| Telegram    | Optional | Unlimited          | Phase 3 ✅ |

Recommended MCP-first configuration for testing:

- X: run XMCP locally and set `X_MCP_ENABLED=true`
- Telegram: run `telegram-mcp` locally and set `TELEGRAM_MCP_ENABLED=true`
- Keep REST/Bot credentials as fallback paths rather than the primary path

## Performance Notes

- Single request latency: ~1-2s (no LLM) or ~3-5s (with LLM API call)
- Can add caching and request deduplication if needed
- BscScan rate limit: 5 calls/sec (adequate for MVP)
- CoinGecko: Unlimited free tier (no bottleneck)

## Deployment Readiness

- ✅ No external dependencies (pure Node.js fetch)
- ✅ Graceful fallbacks at every step
- ✅ Environment variable configuration
- ✅ Error logging for debugging
- ⚠️ No persistent storage yet (stateless)
- ⚠️ No rate limiting or auth on API (add for production)

## Known Limitations

1. Genealogy is still deterministic (hash-based family assignment)
   - Fix: Build genealogy graph from historical meme-token relationships
2. Influencer proof is synthetic (mock names/scores)

- Status: Fixed when credentials are configured; deterministic fallback remains for no-key mode

3. No originality / clone detection yet
   - Fix: Add lineage-type and originality scoring (Phase 4)
4. No cross-lingual narrative comparison yet
   - Fix: Add EN/CN framing summaries (Phase 5)

5. Frontend UI not wired
   - Fix: Create CultureCardPage input/loading/render flow (Phase 6)

## Testing

Quick smoke test:

```bash
cd apps/api
NODE_ENV=development node src/index.mjs

# In another terminal
curl -X POST http://localhost:8787/v1/narrative/culture-card \
  -H "content-type: application/json" \
  -d '{"ca":"0x2170Ed0880ac9A755fd29B2688956BD959F933F8","chain_id":"bsc"}'
```

Expected:

- Response in <2s (no LLM key) or ~4-5s (with LLM)
- Graceful fallback data if any API fails
- All fields populated (real or synthetic)

## Next Priority

**For hackathon MVP**: Finish Phase 3 and Phase 4 before UI polish.

- Phase 1-2 are done and robust
- The differentiator is no longer generic token analysis; it is genealogy, originality, and narrative spread
- UI and export matter, but only after the product proves its cultural-intelligence angle
