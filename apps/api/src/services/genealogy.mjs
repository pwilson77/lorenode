const FAMILY_PROFILES = [
  {
    id: "pepe-meta",
    motifs: ["pepe", "frog", "pond", "green", "smirk"],
    ancestors: ["PEPE", "WOJAK"],
  },
  {
    id: "doge-derivatives",
    motifs: ["doge", "inu", "shib", "pup", "dog"],
    ancestors: ["DOGE", "SHIB"],
  },
  {
    id: "ai-mascot",
    motifs: ["ai", "agent", "bot", "gpt", "neural"],
    ancestors: ["FET", "AGENT"],
  },
  {
    id: "absurdist-remix",
    motifs: ["brainrot", "meme", "chaos", "void", "glitch"],
    ancestors: ["MEME", "REMIX"],
  },
  {
    id: "cat-chaos",
    motifs: ["cat", "kitty", "nyan", "meow", "purr"],
    ancestors: ["POPCAT", "CAT"],
  },
];

const KNOWN_FACTORY_CREATORS = new Set([
  "0x0000000000000000000000000000000000000000",
]);

const CLONE_HINTS = ["v2", "classic", "official", "reborn", "copy", "clone"];
const REVIVAL_HINTS = ["reborn", "revival", "classic", "again", "returns"];

function hashToInt(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pickFamily(tokens, seed) {
  let bestProfile = FAMILY_PROFILES[seed % FAMILY_PROFILES.length];
  let bestScore = -1;
  let secondScore = -1;

  for (const profile of FAMILY_PROFILES) {
    const score = profile.motifs.reduce(
      (sum, motif) => sum + (tokens.includes(motif) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestProfile = profile;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  const confidenceFromSignals =
    bestScore <= 0 ? 0 : bestScore / Math.max(1, bestProfile.motifs.length);
  const margin = Math.max(0, bestScore - Math.max(0, secondScore));
  const confidence = Number(
    clamp(0.52 + confidenceFromSignals * 0.28 + margin * 0.06, 0.5, 0.94).toFixed(2),
  );

  return { profile: bestProfile, confidence, signalScore: bestScore };
}

function computeOriginality({
  tokens,
  motifTags,
  influencerMap,
  creatorAddress,
  familyId,
}) {
  const text = tokens.join(" ");
  const hasRevivalHint = REVIVAL_HINTS.some((hint) => text.includes(hint));
  const cloneHintCount = CLONE_HINTS.reduce(
    (sum, hint) => sum + (text.includes(hint) ? 1 : 0),
    0,
  );

  const topPushers = influencerMap?.top_pushers || [];
  const totalMentions = topPushers.reduce(
    (sum, pusher) => sum + (pusher.mention_count || 0),
    0,
  );
  const concentration = totalMentions
    ? (topPushers[0]?.mention_count || 0) / totalMentions
    : 0.55;
  const uniqueAccounts = influencerMap?.source_stats?.unique_accounts || topPushers.length || 1;
  const creatorNormalized = (creatorAddress || "").toLowerCase();
  const creatorReuseSignal = creatorNormalized && KNOWN_FACTORY_CREATORS.has(creatorNormalized)
    ? 0.82
    : 0.22;

  const motifRichness = motifTags.length / 4;
  const diversityPenalty = clamp(1 - uniqueAccounts / 8, 0, 0.7);
  const concentrationPenalty = clamp((concentration - 0.45) * 1.5, 0, 0.9);
  const cloneHintPenalty = clamp(cloneHintCount * 0.15, 0, 0.6);
  const familyPenalty = familyId === "absurdist-remix" ? 0.12 : 0.04;

  const cloneProbability = Number(
    clamp(
      0.2 +
        concentrationPenalty * 0.35 +
        diversityPenalty * 0.24 +
        cloneHintPenalty * 0.2 +
        creatorReuseSignal * 0.12 +
        familyPenalty -
        motifRichness * 0.18,
      0.05,
      0.95,
    ).toFixed(2),
  );
  const originalityScore = Math.round((1 - cloneProbability) * 100);

  let launchClassification = "original-launch";
  if (hasRevivalHint) {
    launchClassification = "revival";
  } else if (cloneProbability >= 0.72) {
    launchClassification = "low-effort-derivative";
  } else if (cloneProbability >= 0.48) {
    launchClassification = "remix";
  }

  const label =
    originalityScore >= 75
      ? "high-originality"
      : originalityScore >= 45
        ? "moderate-originality"
        : "clone-risk";

  return {
    launchClassification,
    originality: {
      score: originalityScore,
      label,
      clone_probability: cloneProbability,
      creator_reuse_signal: Number(creatorReuseSignal.toFixed(2)),
      heuristic_breakdown: [
        { factor: "motif-richness", impact: Number((motifRichness * 0.18).toFixed(2)) },
        { factor: "narrative-concentration", impact: Number((-concentrationPenalty * 0.35).toFixed(2)) },
        { factor: "account-diversity", impact: Number((-diversityPenalty * 0.24).toFixed(2)) },
        { factor: "clone-hints", impact: Number((-cloneHintPenalty * 0.2).toFixed(2)) },
      ],
    },
  };
}

export function buildGenealogy({
  ca,
  symbol = "MEME",
  tokenName = "",
  influencerMap = null,
  creatorAddress = "",
}) {
  const seed = hashToInt(`${ca}:${symbol}:${tokenName}`);
  const tokens = tokenize(`${tokenName} ${symbol}`);
  const familyPick = pickFamily(tokens, seed);
  const family = familyPick.profile.id;
  const confidence = familyPick.confidence;

  const motifTags = familyPick.profile.motifs
    .filter((motif) => tokens.includes(motif))
    .slice(0, 4);
  if (motifTags.length === 0) {
    motifTags.push(familyPick.profile.motifs[seed % familyPick.profile.motifs.length]);
  }

  const ancestorTokens = [
    {
      ca: `0x${(seed + 11).toString(16).slice(0, 10)}`,
      symbol: familyPick.profile.ancestors[0],
      relation_type: "inherits-from",
      weight: Number(clamp(confidence + 0.08, 0.55, 0.92).toFixed(2)),
    },
    {
      ca: `0x${(seed + 97).toString(16).slice(0, 10)}`,
      symbol: familyPick.profile.ancestors[1],
      relation_type: "remix-of",
      weight: Number(clamp(confidence - 0.09, 0.35, 0.79).toFixed(2)),
    },
  ];

  const originalityIntel = computeOriginality({
    tokens,
    motifTags,
    influencerMap,
    creatorAddress,
    familyId: family,
  });

  return {
    primary_family: family,
    confidence,
    ancestry_confidence: confidence,
    ancestor_tokens: ancestorTokens,
    motif_tags: motifTags,
    slogan_fingerprints: [`${family}-core`, `${originalityIntel.launchClassification}-variant`],
    launch_classification: originalityIntel.launchClassification,
    originality: originalityIntel.originality,
    creator_fingerprint: creatorAddress || null,
    lineage_evidence: [
      `family_signal:${familyPick.signalScore}`,
      `motif_count:${motifTags.length}`,
      `creator_reuse:${originalityIntel.originality.creator_reuse_signal}`,
    ],
  };
}
