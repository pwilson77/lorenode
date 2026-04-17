import type { CultureCardResponse } from "../types";

interface InfluencerProofChipsProps {
  data: CultureCardResponse;
}

export function InfluencerProofChips({ data }: InfluencerProofChipsProps) {
  return (
    <section className="mb-4 rounded-2xl border border-zinc-200 bg-white/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
        Social Proof
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {data.influencer_map.top_pushers.map((pusher) => (
          <div
            key={`${pusher.platform}:${pusher.handle}`}
            className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-800"
          >
            <span className="font-semibold">{pusher.handle}</span>
            <span className="mx-1 text-zinc-400">|</span>
            <span>{pusher.platform}</span>
            <span className="mx-1 text-zinc-400">|</span>
            <span>auth {Math.round(pusher.authenticity_score * 100)}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}
