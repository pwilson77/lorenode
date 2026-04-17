import { useMemo, useState } from "react";
import { CultureCard } from "./components";
import type { CultureCardResponse } from "./types";

const DEMO_CA = "0x2170Ed0880ac9A755fd29B2688956BD959F933F8";
const DEMO_CHAIN = "bsc";

type LoadState = "idle" | "loading" | "ready" | "error";

export function App() {
  const [ca, setCa] = useState(DEMO_CA);
  const [chainId, setChainId] = useState(DEMO_CHAIN);
  const [status, setStatus] = useState<LoadState>("idle");
  const [error, setError] = useState<string>("");
  const [payload, setPayload] = useState<CultureCardResponse | null>(null);

  const canFetch = useMemo(
    () => ca.trim().length > 0 && chainId.trim().length > 0,
    [ca, chainId],
  );

  async function fetchCard() {
    if (!canFetch) {
      return;
    }

    setStatus("loading");
    setError("");

    try {
      const response = await fetch("/api/v1/narrative/culture-card", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ca: ca.trim(),
          chain_id: chainId.trim().toLowerCase(),
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || "Request failed");
      }

      setPayload(json as CultureCardResponse);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unexpected error");
      setPayload(null);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <p className="hero-kicker">LoreNode Frontend</p>
        <h1>Culture Card Workbench</h1>
        <p>
          TypeScript React UI wired to your local LoreNode API with live X and
          Telegram signal overlays.
        </p>

        <div className="controls-grid">
          <label>
            Contract Address
            <input
              value={ca}
              onChange={(event) => setCa(event.target.value)}
              placeholder="0x..."
            />
          </label>

          <label>
            Chain ID
            <input
              value={chainId}
              onChange={(event) => setChainId(event.target.value)}
              placeholder="bsc"
            />
          </label>
        </div>

        <div className="action-row">
          <button
            type="button"
            onClick={fetchCard}
            disabled={!canFetch || status === "loading"}
          >
            {status === "loading" ? "Loading..." : "Build Culture Card"}
          </button>
          <span className={`pill pill-${status}`}>
            {status === "idle" && "Ready"}
            {status === "loading" && "Fetching"}
            {status === "ready" && "Loaded"}
            {status === "error" && "Error"}
          </span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="card-panel">
        {payload ? (
          <CultureCard data={payload} />
        ) : (
          <div className="placeholder-card">
            <h2>No Card Yet</h2>
            <p>Run a request to preview the current token narrative output.</p>
          </div>
        )}
      </section>
    </main>
  );
}
