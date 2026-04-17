function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function buildViralScore({ seed, socialProof, genealogyConfidence }) {
  const momentum = clamp(45 + (seed % 45), 0, 100);
  const proof = clamp(socialProof, 0, 100);
  const cohesion = clamp(Math.round(genealogyConfidence * 100), 0, 100);
  const antiGamingPenalty = clamp((seed >> 4) % 30, 0, 100);

  const scoreTotal = clamp(
    Math.round(
      momentum * 0.4 + proof * 0.3 + cohesion * 0.25 - antiGamingPenalty * 0.15,
    ),
    0,
    100,
  );

  return {
    score_total: scoreTotal,
    momentum_045s: momentum,
    social_proof: proof,
    narrative_cohesion: cohesion,
    anti_gaming_penalty: antiGamingPenalty,
    trend_delta_5m: Number(((momentum - 50) / 10).toFixed(2)),
    trend_delta_1h: Number(((scoreTotal - 50) / 8).toFixed(2)),
    explainability: {
      weighted_factors: [
        {
          factor: "momentum_045s",
          weight: 0.4,
          contribution: Number((momentum * 0.4).toFixed(2)),
        },
        {
          factor: "social_proof",
          weight: 0.3,
          contribution: Number((proof * 0.3).toFixed(2)),
        },
        {
          factor: "narrative_cohesion",
          weight: 0.25,
          contribution: Number((cohesion * 0.25).toFixed(2)),
        },
        {
          factor: "anti_gaming_penalty",
          weight: -0.15,
          contribution: Number((-antiGamingPenalty * 0.15).toFixed(2)),
        },
      ],
    },
  };
}
