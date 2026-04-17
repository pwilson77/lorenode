import type { CultureCardResponse } from "../types";

interface LineageRibbonProps {
  data: CultureCardResponse;
}

export function LineageRibbon({ data }: LineageRibbonProps) {
  return (
    <section className="mb-4 rounded-2xl border border-orange-200 bg-white/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-orange-700">
        Lineage
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white">
          {data.genealogy.primary_family}
        </span>
        {data.genealogy.ancestor_tokens.map((ancestor) => (
          <span
            key={ancestor.ca}
            className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700"
          >
            {ancestor.symbol} ({ancestor.relation_type})
          </span>
        ))}
      </div>
    </section>
  );
}
