import type { CultureCardResponse } from "../types";

interface LoreBlurbProps {
  data: CultureCardResponse;
}

export function LoreBlurb({ data }: LoreBlurbProps) {
  return (
    <section className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/80 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">
        Origin Story
      </p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-800">
        {data.lore.summary_2_sentences}
      </p>
      <p className="mt-2 text-xs text-zinc-600">
        Grounding confidence:{" "}
        {(data.lore.grounding_confidence * 100).toFixed(0)}%
      </p>
    </section>
  );
}
