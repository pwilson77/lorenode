import { searchRecentPostsViaXMcp } from "./xMcpClient.mjs";
import { searchGlobalMessagesViaTelegramMcp } from "./telegramMcpClient.mjs";

function hashToInt(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeHandle(handle, fallback) {
  const value =
    typeof handle === "string" && handle.trim() ? handle.trim() : fallback;
  return value.startsWith("@") ? value : `@${value}`;
}

function hoursBetween(nowMs, isoString) {
  const ts = Date.parse(isoString);
  if (Number.isNaN(ts)) {
    return 24;
  }

  return Math.max(1, (nowMs - ts) / 3600000);
}

function computeXAuthenticity(user) {
  const followers = user?.public_metrics?.followers_count ?? 0;
  const tweetCount = user?.public_metrics?.tweet_count ?? 0;
  const verifiedBonus = user?.verified ? 0.12 : 0;
  const ageBonus = user?.created_at ? 0.08 : 0;
  const followerComponent = Math.min(0.4, Math.log10(followers + 1) / 10);
  const activityPenalty = tweetCount > 0 && followers === 0 ? 0.08 : 0;

  return Number(
    clamp(
      0.42 + followerComponent + verifiedBonus + ageBonus - activityPenalty,
      0.2,
      0.98,
    ).toFixed(2),
  );
}

function buildSearchTerms({ ca, tokenSymbol, tokenName }) {
  const terms = [ca];

  if (tokenSymbol && tokenSymbol.length >= 3 && tokenSymbol.length <= 10) {
    terms.push(`\"${tokenSymbol}\"`);
  }

  if (tokenName && tokenName.length >= 4 && tokenName.length <= 32) {
    terms.push(`\"${tokenName}\"`);
  }

  return terms;
}

async function fetchXSignals({ ca, tokenSymbol, tokenName, lookbackSec }) {
  const useXMcp = process.env.X_MCP_ENABLED === "true";
  const bearerToken =
    process.env.TWITTER_BEARER_TOKEN ||
    process.env.X_BEARER_TOKEN ||
    process.env.TWITTER_API_BEARER_TOKEN;

  if (!useXMcp && !bearerToken) {
    return {
      pushers: [],
      evidenceRefs: [],
      stats: { mentions: 0, source: "fallback-no-x-token" },
    };
  }

  const query = `${buildSearchTerms({ ca, tokenSymbol, tokenName }).join(" OR ")} -is:retweet`;
  const startTime = new Date(Date.now() - lookbackSec * 1000).toISOString();

  try {
    let payload = null;
    let source = "x-rest";

    if (useXMcp) {
      payload = await searchRecentPostsViaXMcp({ query, maxResults: 10 });
      if (payload) {
        source = "xmcp";
      }
    }

    if (!payload) {
      if (!bearerToken) {
        return {
          pushers: [],
          evidenceRefs: [],
          stats: {
            mentions: 0,
            source: useXMcp ? "xmcp-unavailable" : "fallback-no-x-token",
          },
        };
      }

      const response = await fetch(
        `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=10&tweet.fields=created_at,public_metrics,lang&expansions=author_id&user.fields=username,verified,public_metrics,created_at`,
        {
          headers: {
            authorization: `Bearer ${bearerToken}`,
          },
        },
      );

      if (!response.ok) {
        console.warn(`X recent search failed with ${response.status}`);
        return {
          pushers: [],
          evidenceRefs: [],
          stats: { mentions: 0, source: "x-error" },
        };
      }

      payload = await response.json();
    }

    const users = new Map(
      (payload.includes?.users || []).map((user) => [user.id, user]),
    );
    const tweets = (payload.data || []).filter(
      (tweet) => Date.parse(tweet.created_at) >= Date.parse(startTime),
    );
    const aggregated = new Map();
    const nowMs = Date.now();

    for (const tweet of tweets) {
      const user = users.get(tweet.author_id);
      const username = user?.username || `xuser${tweet.author_id || "unknown"}`;
      const key = `x:${username}`;
      const current = aggregated.get(key) || {
        handle: normalizeHandle(username, "@x_unknown"),
        platform: "x",
        authenticity_score: computeXAuthenticity(user),
        engagement_velocity: 0,
        mention_count: 0,
        evidence_count: 0,
        latest_seen_at: tweet.created_at,
        evidence_refs: [],
      };

      const publicMetrics = tweet.public_metrics || {};
      const totalEngagement =
        (publicMetrics.like_count || 0) +
        (publicMetrics.retweet_count || 0) +
        (publicMetrics.reply_count || 0) +
        (publicMetrics.quote_count || 0);
      const hours = hoursBetween(nowMs, tweet.created_at);
      const velocity = Number((totalEngagement / hours + 1).toFixed(2));

      current.engagement_velocity = Number(
        (
          (current.engagement_velocity * current.mention_count + velocity) /
          (current.mention_count + 1)
        ).toFixed(2),
      );
      current.mention_count += 1;
      current.evidence_count += 1;
      current.latest_seen_at =
        current.latest_seen_at > tweet.created_at
          ? current.latest_seen_at
          : tweet.created_at;
      current.evidence_refs.push(
        `https://x.com/${username}/status/${tweet.id}`,
      );
      aggregated.set(key, current);
    }

    const pushers = Array.from(aggregated.values())
      .map((pusher) => ({
        ...pusher,
        evidence_refs: pusher.evidence_refs.slice(0, 3),
      }))
      .sort((left, right) => {
        const leftScore =
          left.engagement_velocity *
          left.mention_count *
          left.authenticity_score;
        const rightScore =
          right.engagement_velocity *
          right.mention_count *
          right.authenticity_score;
        return rightScore - leftScore;
      });

    return {
      pushers,
      evidenceRefs: pushers
        .flatMap((pusher) => pusher.evidence_refs)
        .slice(0, 6),
      stats: {
        mentions: tweets.length,
        unique_accounts: pushers.length,
        source,
      },
    };
  } catch (error) {
    console.warn("X signal fetch failed:", error.message);
    return {
      pushers: [],
      evidenceRefs: [],
      stats: { mentions: 0, source: "x-error" },
    };
  }
}

function normalizeTelegramText(update) {
  return update?.channel_post?.text || update?.message?.text || "";
}

function normalizeTelegramChat(update) {
  return update?.channel_post?.chat || update?.message?.chat || null;
}

function normalizeTelegramDate(update) {
  const seconds = update?.channel_post?.date || update?.message?.date;
  if (!seconds) {
    return null;
  }

  return new Date(seconds * 1000).toISOString();
}

function computeTelegramAuthenticity(messageCount) {
  return Number(
    clamp(0.56 + Math.min(0.22, messageCount * 0.04), 0.25, 0.9).toFixed(2),
  );
}

function buildTelegramTerms({ ca, tokenSymbol, tokenName }) {
  const terms = [ca];

  if (tokenSymbol && tokenSymbol.length >= 2 && tokenSymbol.length <= 10) {
    terms.push(tokenSymbol);
  }

  if (tokenName && tokenName.length >= 4 && tokenName.length <= 32) {
    terms.push(tokenName);
  }

  return terms;
}

function aggregateTelegramMessages(messages, lookbackSec) {
  const thresholdMs = Date.now() - lookbackSec * 1000;
  const aggregated = new Map();

  for (const message of messages || []) {
    const isoDate = message?.date ? new Date(message.date).toISOString() : null;
    if (
      !isoDate ||
      Number.isNaN(Date.parse(isoDate)) ||
      Date.parse(isoDate) < thresholdMs
    ) {
      continue;
    }

    const chatName = message.chat_name || "telegram-channel";
    const normalizedHandle = normalizeHandle(
      String(chatName).replace(/^@/, "").replace(/\s+/g, "_").toLowerCase(),
      "@telegram_channel",
    );
    const key = `telegram:${normalizedHandle}`;
    const current = aggregated.get(key) || {
      handle: normalizedHandle,
      platform: "telegram",
      authenticity_score: 0.58,
      engagement_velocity: 1,
      mention_count: 0,
      evidence_count: 0,
      latest_seen_at: isoDate,
      evidence_refs: [],
    };

    current.mention_count += 1;
    current.evidence_count += 1;
    current.authenticity_score = computeTelegramAuthenticity(
      current.mention_count,
    );
    current.engagement_velocity = Number(
      (current.engagement_velocity + 0.8).toFixed(2),
    );
    current.latest_seen_at =
      current.latest_seen_at > isoDate ? current.latest_seen_at : isoDate;
    current.evidence_refs = Array.from(
      new Set([
        ...current.evidence_refs,
        message.message_id
          ? `telegram:${chatName}:${message.message_id}`
          : `telegram:${chatName}`,
      ]),
    ).slice(0, 3);
    aggregated.set(key, current);
  }

  return Array.from(aggregated.values()).sort(
    (left, right) => right.mention_count - left.mention_count,
  );
}

async function fetchTelegramSignals({
  ca,
  tokenSymbol,
  tokenName,
  lookbackSec,
}) {
  const useTelegramMcp = process.env.TELEGRAM_MCP_ENABLED === "true";
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!useTelegramMcp && !botToken) {
    return {
      pushers: [],
      evidenceRefs: [],
      stats: { mentions: 0, source: "fallback-no-telegram-token" },
    };
  }

  const telegramQuery = buildTelegramTerms({ ca, tokenSymbol, tokenName }).join(
    " OR ",
  );

  if (useTelegramMcp) {
    try {
      const messages = await searchGlobalMessagesViaTelegramMcp({
        query: telegramQuery,
        pageSize: 20,
      });

      if (Array.isArray(messages) && messages.length > 0) {
        const pushers = aggregateTelegramMessages(messages, lookbackSec);
        if (pushers.length > 0) {
          return {
            pushers,
            evidenceRefs: pushers
              .flatMap((pusher) => pusher.evidence_refs)
              .slice(0, 6),
            stats: {
              mentions: pushers.reduce(
                (sum, pusher) => sum + pusher.mention_count,
                0,
              ),
              unique_accounts: pushers.length,
              source: "telegram-mcp",
            },
          };
        }
      }
    } catch (error) {
      console.warn("Telegram MCP signal fetch failed:", error.message);
    }
  }

  if (!botToken) {
    return {
      pushers: [],
      evidenceRefs: [],
      stats: {
        mentions: 0,
        source: useTelegramMcp
          ? "telegram-mcp-unavailable"
          : "fallback-no-telegram-token",
      },
    };
  }

  const configuredChats = new Set(
    (process.env.TELEGRAM_SOURCE_CHATS || "")
      .split(",")
      .map((value) => value.trim().replace(/^@/, ""))
      .filter(Boolean),
  );
  const terms = [ca.toLowerCase()];
  if (tokenSymbol) terms.push(tokenSymbol.toLowerCase());
  if (tokenName) terms.push(tokenName.toLowerCase());

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates?limit=100&allowed_updates=${encodeURIComponent('["message","channel_post"]')}`,
    );
    if (!response.ok) {
      console.warn(`Telegram getUpdates failed with ${response.status}`);
      return {
        pushers: [],
        evidenceRefs: [],
        stats: { mentions: 0, source: "telegram-error" },
      };
    }

    const payload = await response.json();
    const thresholdMs = Date.now() - lookbackSec * 1000;
    const aggregated = new Map();

    for (const update of payload.result || []) {
      const text = normalizeTelegramText(update);
      const normalizedText = text.toLowerCase();
      if (!text || !terms.some((term) => normalizedText.includes(term))) {
        continue;
      }

      const isoDate = normalizeTelegramDate(update);
      if (!isoDate || Date.parse(isoDate) < thresholdMs) {
        continue;
      }

      const chat = normalizeTelegramChat(update);
      const username = chat?.username || chat?.title || "telegram-channel";
      const normalizedUsername = username.replace(/^@/, "");
      if (
        configuredChats.size > 0 &&
        !configuredChats.has(normalizedUsername)
      ) {
        continue;
      }

      const key = `telegram:${normalizedUsername}`;
      const current = aggregated.get(key) || {
        handle: normalizeHandle(normalizedUsername, "@telegram_channel"),
        platform: "telegram",
        authenticity_score: 0.58,
        engagement_velocity: 1,
        mention_count: 0,
        evidence_count: 0,
        latest_seen_at: isoDate,
        evidence_refs: [],
      };

      current.mention_count += 1;
      current.evidence_count += 1;
      current.engagement_velocity = Number(
        (current.engagement_velocity + 0.75).toFixed(2),
      );
      current.latest_seen_at =
        current.latest_seen_at > isoDate ? current.latest_seen_at : isoDate;
      current.evidence_refs.push(
        chat?.username
          ? `https://t.me/${chat.username}`
          : `telegram:${normalizedUsername}`,
      );
      aggregated.set(key, current);
    }

    const pushers = Array.from(aggregated.values())
      .map((pusher) => ({
        ...pusher,
        authenticity_score: Number(
          clamp(
            pusher.authenticity_score +
              Math.min(0.18, pusher.mention_count * 0.03),
            0.2,
            0.92,
          ).toFixed(2),
        ),
        evidence_refs: pusher.evidence_refs.slice(0, 3),
      }))
      .sort((left, right) => right.mention_count - left.mention_count);

    return {
      pushers,
      evidenceRefs: pushers
        .flatMap((pusher) => pusher.evidence_refs)
        .slice(0, 6),
      stats: {
        mentions: pushers.reduce(
          (sum, pusher) => sum + pusher.mention_count,
          0,
        ),
        unique_accounts: pushers.length,
        source: "telegram",
      },
    };
  } catch (error) {
    console.warn("Telegram signal fetch failed:", error.message);
    return {
      pushers: [],
      evidenceRefs: [],
      stats: { mentions: 0, source: "telegram-error" },
    };
  }
}

function buildFallbackInfluencerMap(ca) {
  const seed = hashToInt(ca);
  const topPushers = [
    {
      handle: `@memealpha${seed % 100}`,
      platform: "x",
      authenticity_score: Number((0.55 + (seed % 40) / 100).toFixed(2)),
      engagement_velocity: Number((1 + (seed % 60) / 20).toFixed(2)),
      mention_count: 2 + (seed % 12),
      evidence_count: 0,
      latest_seen_at: null,
      evidence_refs: [],
    },
    {
      handle: `@tgtrend${(seed >>> 3) % 100}`,
      platform: "telegram",
      authenticity_score: Number((0.5 + ((seed >>> 2) % 45) / 100).toFixed(2)),
      engagement_velocity: Number((1 + ((seed >>> 4) % 80) / 20).toFixed(2)),
      mention_count: 1 + ((seed >>> 5) % 10),
      evidence_count: 0,
      latest_seen_at: null,
      evidence_refs: [],
    },
  ];

  const avgAuth =
    topPushers.reduce((sum, pusher) => sum + pusher.authenticity_score, 0) /
    topPushers.length;
  const socialProofScore = Math.round(
    topPushers.reduce(
      (sum, pusher) =>
        sum +
        pusher.engagement_velocity *
          pusher.mention_count *
          pusher.authenticity_score,
      0,
    ) * 4,
  );

  return {
    top_pushers: topPushers,
    coordination_risk: Number((1 - avgAuth).toFixed(2)),
    social_proof_score: Math.max(0, Math.min(100, socialProofScore)),
    evidence_refs: [],
    source_stats: {
      x_mentions: 0,
      telegram_mentions: 0,
      unique_accounts: topPushers.length,
      data_source:
        process.env.X_MCP_ENABLED === "true" ||
        process.env.TELEGRAM_MCP_ENABLED === "true"
          ? "synthetic-fallback+mcp-configured"
          : "synthetic-fallback",
    },
  };
}

function mergePushers(pushers) {
  const aggregated = new Map();

  for (const pusher of pushers) {
    const key = `${pusher.platform}:${pusher.handle.toLowerCase()}`;
    const current = aggregated.get(key) || {
      handle: pusher.handle,
      platform: pusher.platform,
      authenticity_score: pusher.authenticity_score,
      engagement_velocity: 0,
      mention_count: 0,
      evidence_count: 0,
      latest_seen_at: pusher.latest_seen_at,
      evidence_refs: [],
    };

    const mergedMentions = current.mention_count + pusher.mention_count;
    current.engagement_velocity = Number(
      (
        (current.engagement_velocity * current.mention_count +
          pusher.engagement_velocity * pusher.mention_count) /
        Math.max(1, mergedMentions)
      ).toFixed(2),
    );
    current.authenticity_score = Number(
      ((current.authenticity_score + pusher.authenticity_score) / 2).toFixed(2),
    );
    current.mention_count = mergedMentions;
    current.evidence_count += pusher.evidence_count || 0;
    current.latest_seen_at =
      current.latest_seen_at && pusher.latest_seen_at
        ? current.latest_seen_at > pusher.latest_seen_at
          ? current.latest_seen_at
          : pusher.latest_seen_at
        : current.latest_seen_at || pusher.latest_seen_at;
    current.evidence_refs = Array.from(
      new Set([...current.evidence_refs, ...(pusher.evidence_refs || [])]),
    ).slice(0, 3);
    aggregated.set(key, current);
  }

  return Array.from(aggregated.values()).sort((left, right) => {
    const leftScore =
      left.engagement_velocity * left.mention_count * left.authenticity_score;
    const rightScore =
      right.engagement_velocity *
      right.mention_count *
      right.authenticity_score;
    return rightScore - leftScore;
  });
}

export async function buildInfluencerMap({
  ca,
  tokenSymbol,
  tokenName,
  lookbackSec = 300,
}) {
  const [xSignals, telegramSignals] = await Promise.all([
    fetchXSignals({ ca, tokenSymbol, tokenName, lookbackSec }),
    fetchTelegramSignals({ ca, tokenSymbol, tokenName, lookbackSec }),
  ]);

  const mergedPushers = mergePushers([
    ...xSignals.pushers,
    ...telegramSignals.pushers,
  ]);
  if (mergedPushers.length === 0) {
    return buildFallbackInfluencerMap(ca);
  }

  const avgAuth =
    mergedPushers.reduce((sum, pusher) => sum + pusher.authenticity_score, 0) /
    mergedPushers.length;
  const totalMentions = mergedPushers.reduce(
    (sum, pusher) => sum + pusher.mention_count,
    0,
  );
  const concentration = mergedPushers[0]
    ? mergedPushers[0].mention_count / Math.max(1, totalMentions)
    : 0;
  const socialProofScore = clamp(
    Math.round(
      mergedPushers.reduce(
        (sum, pusher) =>
          sum +
          pusher.engagement_velocity *
            pusher.mention_count *
            pusher.authenticity_score,
        0,
      ) * 6,
    ),
    0,
    100,
  );

  return {
    top_pushers: mergedPushers.slice(0, 5),
    coordination_risk: Number(
      clamp(0.15 + concentration * 0.55 + (1 - avgAuth) * 0.3, 0, 1).toFixed(2),
    ),
    social_proof_score: socialProofScore,
    evidence_refs: Array.from(
      new Set([...xSignals.evidenceRefs, ...telegramSignals.evidenceRefs]),
    ).slice(0, 8),
    source_stats: {
      x_mentions: xSignals.stats.mentions || 0,
      telegram_mentions: telegramSignals.stats.mentions || 0,
      unique_accounts: mergedPushers.length,
      data_source: [xSignals.stats.source, telegramSignals.stats.source].join(
        "+",
      ),
    },
  };
}
