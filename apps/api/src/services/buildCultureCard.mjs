import { buildGenealogy } from "./genealogy.mjs";
import { fetchTokenMetadataFromBnbMcp } from "./bnbMcpClient.mjs";
import { buildInfluencerMap } from "./socialProof.mjs";
import { buildLore } from "./lore.mjs";
import { buildViralScore } from "./viral.mjs";

function hashToInt(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

async function fetchBscTokenMetadata(ca) {
  const bscScanKey = process.env.BSCSCAN_API_KEY;
  if (!bscScanKey) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.bscscan.com/api?module=contract&action=getsourcecode&address=${ca}&apikey=${bscScanKey}`,
    );
    if (!response.ok) return null;

    const data = await response.json();
    const source = data.result?.[0];
    if (!source) return null;

    return {
      name: source.ContractName || null,
      symbol: null,
      createdAt: null,
      source,
    };
  } catch (error) {
    console.warn("BscScan fetch failed:", error.message);
    return null;
  }
}

async function fetchCoinGeckoPrice(symbol) {
  if (!symbol || symbol.length > 10) return null;

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`,
    );
    if (!response.ok) return null;

    const data = await response.json();
    const coin = data.coins?.[0];
    if (!coin) return null;

    return {
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      logo_url: coin.large || null,
      market_cap_rank: coin.market_cap_rank,
    };
  } catch (error) {
    console.warn("CoinGecko fetch failed:", error.message);
    return null;
  }
}

function createFallbackToken(ca, seed) {
  const symbol = `M${(seed % 9000) + 1000}`;
  return {
    name: `Lore ${symbol}`,
    symbol,
    logo_url: null,
  };
}

export async function buildCultureCardPayload(request) {
  const ca = request.ca;
  const chainId = request.chain_id;
  const seed = hashToInt(`${ca}:${chainId}`);
  const socialLookbackSec = request.block_window_sec ?? 300;

  let tokenName = null;
  let tokenSymbol = null;
  let logoUrl = null;
  let metadataSource = "fallback";

  const mcpMetadata = await fetchTokenMetadataFromBnbMcp(ca, chainId || "bsc");
  if (mcpMetadata?.name && mcpMetadata?.symbol) {
    tokenName = mcpMetadata.name;
    tokenSymbol = mcpMetadata.symbol;
    metadataSource = "bnbchain-mcp";
  }

  if (!tokenName || !tokenSymbol) {
    const bscMetadata = await fetchBscTokenMetadata(ca);
    if (bscMetadata?.name) {
      tokenName = bscMetadata.name;
      metadataSource = "bscscan";
      const cgData = await fetchCoinGeckoPrice(bscMetadata.name);
      if (cgData) {
        tokenSymbol = cgData.symbol;
        logoUrl = cgData.logo_url;
        metadataSource = "coingecko+bscscan";
      }
    }
  }

  if (!tokenName || !tokenSymbol) {
    const fallback = createFallbackToken(ca, seed);
    tokenName = fallback.name;
    tokenSymbol = fallback.symbol;
    logoUrl = fallback.logo_url;
    metadataSource = "fallback";
  }

  const genealogy = buildGenealogy({ ca, symbol: tokenSymbol });
  const influencerMap = await buildInfluencerMap({
    ca,
    tokenSymbol,
    tokenName,
    lookbackSec: socialLookbackSec,
  });
  const lore = await buildLore({
    genealogy,
    influencerMap,
    confidence: genealogy.confidence,
    tokenName,
    tokenSymbol,
  });

  const viralScorecard = buildViralScore({
    seed,
    socialProof: influencerMap.social_proof_score,
    genealogyConfidence: genealogy.confidence,
  });

  const now = new Date().toISOString();

  return {
    token: {
      ca,
      chain_id: chainId,
      symbol: tokenSymbol,
      name: tokenName,
      logo_url: logoUrl,
      created_at_block: null,
    },
    genealogy,
    lore,
    viral_scorecard: viralScorecard,
    influencer_map: {
      top_pushers: influencerMap.top_pushers,
      coordination_risk: influencerMap.coordination_risk,
      evidence_refs: influencerMap.evidence_refs,
      source_stats: influencerMap.source_stats,
    },
    freshness: {
      computed_at: now,
      social_lookback_sec: socialLookbackSec,
      data_lag_sec: 5,
    },
    share: {
      culture_card_image_url: null,
      render_theme: "sunset-signal",
      aspect_ratio: "4:5",
    },
    meta: {
      schema_version: "1.1.0",
      request_id: `req_${seed.toString(16)}`,
      metadata_source: metadataSource,
      social_data_source:
        influencerMap.source_stats?.data_source || "synthetic-fallback",
    },
  };
}
