import type { CultureCardResponse } from "../types";

interface ViralDialRowProps {
  data: CultureCardResponse;
}

function Meter({
  label,
  value,
  inverse = false,
}: {
  label: string;
  value: number;
  inverse?: boolean;
}) {
  const normalized = Math.max(0, Math.min(100, value));
  const color = inverse ? "bg-rose-500" : "bg-orange-500";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-zinc-700">
        <span>{label}</span>
        <span className="font-semibold">{normalized}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-200">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${normalized}%` }}
        />
      </div>
    </div>
  );
}

export function ViralDialRow({ data }: ViralDialRowProps) {
  const score = data.viral_scorecard;

  return (
    <section className="mb-4 space-y-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
        Viral Scorecard
      </p>
      <Meter label="Momentum (0.45s)" value={score.momentum_045s} />
      <Meter label="Social Proof" value={score.social_proof} />
      <Meter label="Narrative Cohesion" value={score.narrative_cohesion} />
      <Meter
        label="Anti-gaming Penalty"
        value={score.anti_gaming_penalty}
        inverse
      />
    </section>
  );
}
