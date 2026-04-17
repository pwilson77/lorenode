function pickCatalyst(topPushers) {
  if (!topPushers || topPushers.length === 0) {
    return "a fast chat-room echo cycle";
  }

  const first = topPushers[0];
  return `a push from ${first.handle} on ${first.platform}`;
}

function buildFallbackLore(genealogy, influencerMap, confidence) {
  const lineageSentence = `This token reads like a ${genealogy.primary_family} branch, carrying motifs from earlier ${genealogy.ancestor_tokens[0].symbol}-style meme cycles.`;
  const catalystSentence = `Right now its spark looks tied to ${pickCatalyst(influencerMap.top_pushers)}, so the story is loud but still forming in real time.`;

  return {
    summary_2_sentences: `${lineageSentence} ${catalystSentence}`,
    style: "witty_historian",
    grounding_confidence: Number(confidence.toFixed(2)),
    evidence_refs: [
      "genealogy.primary_family",
      "influencer_map.top_pushers[0]",
    ],
    llm_used: false,
  };
}

async function callOpenRouter(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    };

    if (process.env.OPENROUTER_SITE_URL) {
      headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
    }

    headers["X-OpenRouter-Title"] =
      process.env.OPENROUTER_APP_NAME || "LoreNode";

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a cultural historian for meme tokens. Output exactly 2 sentences, max 45 words total, grounded in evidence provided. No hashtags, no emojis, no financial advice. Acknowledge ambiguity if confidence is weak.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 100,
          temperature: 0.7,
        }),
      },
    );

    if (!response.ok) {
      console.warn(`OpenRouter API returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.warn("OpenRouter call failed:", error.message);
    return null;
  }
}

export async function buildLore({
  genealogy,
  influencerMap,
  confidence,
  tokenName,
  tokenSymbol,
}) {
  const ancestors = genealogy.ancestor_tokens
    .map((a) => `${a.symbol} (${a.relation_type})`)
    .join(", ");
  const influencers = influencerMap.top_pushers
    .slice(0, 2)
    .map(
      (p) =>
        `${p.handle} on ${p.platform} (auth ${Math.round(p.authenticity_score * 100)}%)`,
    )
    .join(", ");

  const prompt = `Token: ${tokenName} (${tokenSymbol})
  Meme family: ${genealogy.primary_family}
  Ancestors: ${ancestors}
  Current pushers: ${influencers}
  Genealogy confidence: ${Math.round(confidence * 100)}%

  Write exactly 2 sentences explaining this token's origin story and current momentum. Be witty and grounded in the evidence provided.`;

  let summary = await callOpenRouter(prompt);

  if (!summary) {
    const fallback = buildFallbackLore(genealogy, influencerMap, confidence);
    return { ...fallback, llm_used: false };
  }

  return {
    summary_2_sentences: summary,
    style: "witty_historian",
    grounding_confidence: Number(confidence.toFixed(2)),
    evidence_refs: [
      "genealogy.primary_family",
      ...(influencerMap.evidence_refs || []).slice(0, 2),
    ],
    llm_used: true,
    llm_provider: "openrouter",
  };
}
