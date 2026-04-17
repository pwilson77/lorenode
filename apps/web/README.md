# LoreNode Web App (TypeScript)

This is a runnable TypeScript React UI for testing LoreNode Culture Card output.

## Run locally

1. Start API server (port 8787 by default)
2. In this folder:

```bash
npm install
npm run dev
```

The Vite dev server proxies `/api/*` requests to `http://127.0.0.1:8787`.

## Components

- `CultureCard`: top-level composition component
- `LineageRibbon`: meme family and ancestor chips
- `LoreBlurb`: fixed two-sentence lore text with confidence
- `ViralDialRow`: score bars for momentum/social proof/cohesion/penalty
- `InfluencerProofChips`: influencer handles and authenticity
- `FreshnessFooter`: freshness and schema version metadata
