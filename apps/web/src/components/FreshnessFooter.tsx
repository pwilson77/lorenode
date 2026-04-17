import type { CultureCardResponse } from "../types";

interface FreshnessFooterProps {
  data: CultureCardResponse;
}

export function FreshnessFooter({ data }: FreshnessFooterProps) {
  const computed = new Date(data.freshness.computed_at).toLocaleString();

  return (
    <footer className="rounded-xl border border-zinc-200 bg-white/75 p-2 text-xs text-zinc-600">
      <p>Computed: {computed}</p>
      <p>Lookback: {data.freshness.social_lookback_sec}s</p>
      <p>Schema: {data.meta.schema_version}</p>
    </footer>
  );
}
