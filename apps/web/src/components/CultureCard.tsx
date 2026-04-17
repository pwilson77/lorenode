import type { CultureCardResponse } from "../types";
import { LineageRibbon } from "./LineageRibbon";
import { LoreBlurb } from "./LoreBlurb";
import { ViralDialRow } from "./ViralDialRow";
import { InfluencerProofChips } from "./InfluencerProofChips";
import { FreshnessFooter } from "./FreshnessFooter";

interface CultureCardProps {
  data: CultureCardResponse;
}

export function CultureCard({ data }: CultureCardProps) {
  return (
    <article className="w-full max-w-xl rounded-3xl border border-orange-200 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-100 p-5 shadow-xl shadow-orange-200/40">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
            LoreNode Culture Card
          </p>
          <h1 className="mt-1 text-2xl font-black text-zinc-900">
            {data.token.name}
          </h1>
          <p className="text-sm text-zinc-600">
            {data.token.symbol} • {data.token.chain_id}
          </p>
        </div>
        <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-amber-100">
          Viral {data.viral_scorecard.score_total}
        </span>
      </header>

      <LineageRibbon data={data} />
      <LoreBlurb data={data} />
      <ViralDialRow data={data} />
      <InfluencerProofChips data={data} />
      <FreshnessFooter data={data} />
    </article>
  );
}
