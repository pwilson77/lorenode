const FAMILIES = [
  "pepe-meta",
  "doge-derivatives",
  "ai-mascot",
  "absurdist-remix",
  "cat-chaos",
];

const MOTIFS = [
  "frog",
  "dog",
  "cat",
  "robot",
  "hat",
  "laser-eyes",
  "moon",
  "coin",
];

function hashToInt(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function buildGenealogy({ ca, symbol = "MEME" }) {
  const seed = hashToInt(`${ca}:${symbol}`);
  const family = FAMILIES[seed % FAMILIES.length];
  const confidence = Number((0.55 + (seed % 35) / 100).toFixed(2));

  const motifTags = [
    MOTIFS[seed % MOTIFS.length],
    MOTIFS[(seed >>> 3) % MOTIFS.length],
    MOTIFS[(seed >>> 5) % MOTIFS.length],
  ].filter((value, idx, arr) => arr.indexOf(value) === idx);

  const ancestorTokens = [
    {
      ca: `0x${(seed + 11).toString(16).slice(0, 10)}`,
      symbol: family.startsWith("pepe")
        ? "PEPE"
        : family.startsWith("doge")
          ? "DOGE"
          : "MEME",
      relation_type: "inherits-from",
      weight: 0.72,
    },
    {
      ca: `0x${(seed + 97).toString(16).slice(0, 10)}`,
      symbol: "REMIX",
      relation_type: "remix-of",
      weight: 0.58,
    },
  ];

  return {
    primary_family: family,
    confidence,
    ancestor_tokens: ancestorTokens,
    motif_tags: motifTags,
    slogan_fingerprints: [`${family}-core`, `${family}-variant`],
  };
}
