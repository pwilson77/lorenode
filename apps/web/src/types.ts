export interface CultureCardResponse {
  token: {
    ca: string;
    chain_id: string;
    symbol: string;
    name: string;
    logo_url: string | null;
    created_at_block: number | null;
  };
  genealogy: {
    primary_family: string;
    confidence: number;
    ancestor_tokens: Array<{
      ca: string;
      symbol: string;
      relation_type: string;
      weight: number;
    }>;
    motif_tags: string[];
    slogan_fingerprints: string[];
  };
  lore: {
    summary_2_sentences: string;
    style: string;
    grounding_confidence: number;
    evidence_refs: string[];
  };
  viral_scorecard: {
    score_total: number;
    momentum_045s: number;
    social_proof: number;
    narrative_cohesion: number;
    anti_gaming_penalty: number;
    trend_delta_5m: number;
    trend_delta_1h: number;
    explainability: {
      weighted_factors: Array<{
        factor: string;
        weight: number;
        contribution: number;
      }>;
    };
  };
  influencer_map: {
    top_pushers: Array<{
      handle: string;
      platform: string;
      authenticity_score: number;
      engagement_velocity: number;
      mention_count: number;
      evidence_count?: number;
      latest_seen_at?: string | null;
      evidence_refs?: string[];
    }>;
    coordination_risk: number;
    evidence_refs?: string[];
    source_stats?: {
      x_mentions: number;
      telegram_mentions: number;
      unique_accounts: number;
      data_source: string;
    };
  };
  freshness: {
    computed_at: string;
    social_lookback_sec: number;
    data_lag_sec: number;
  };
  share: {
    culture_card_image_url: string | null;
    render_theme: string;
    aspect_ratio: string;
  };
  meta: {
    schema_version: string;
    request_id: string;
    metadata_source?: string;
    social_data_source?: string;
  };
}
