import { useMemo, useState } from "react";
import type { ReactNode } from "react";

interface AgentWorkshopProps {
  onPreviewArena: () => void;
}

const brainModels = ["gpt-4.1", "o3", "gpt-5.2"] as const;
const strategies = ["Volatility Expansion", "Mean Reversion", "Oracle Drift"] as const;
const riskProfiles = ["Defensive", "Balanced", "Aggressive"] as const;
const dataInputs = ["BTC 1m Candles", "Orderbook Depth", "Oracle Drift", "Funding Flips"] as const;

export function AgentWorkshop({ onPreviewArena }: AgentWorkshopProps) {
  const [brainModel, setBrainModel] = useState<(typeof brainModels)[number]>("gpt-4.1");
  const [strategy, setStrategy] = useState<(typeof strategies)[number]>("Volatility Expansion");
  const [riskProfile, setRiskProfile] = useState<(typeof riskProfiles)[number]>("Balanced");
  const [selectedInputs, setSelectedInputs] = useState<string[]>(["BTC 1m Candles"]);
  const [mockDeployState, setMockDeployState] = useState<"idle" | "success">("idle");

  const previewSummary = useMemo(
    () => ({
      model: brainModel,
      strategy,
      riskProfile,
      inputs: selectedInputs
    }),
    [brainModel, riskProfile, selectedInputs, strategy]
  );

  return (
    <section className="paper-frame mx-auto max-w-[1440px] bg-surface/90">
      <div className="border-b-2 border-outline-variant px-4 py-6 md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="paper-chip paper-chip-green px-2 py-1">Draft_agent_772</span>
              <span className="paper-chip paper-chip-orange px-2 py-1">Demo only</span>
            </div>
            <h1 className="mt-4 font-display text-4xl font-black uppercase leading-none text-on-surface">Agent Workshop</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="paper-button px-4 py-2 font-display text-xs font-black uppercase" type="button">
              Save Draft
            </button>
            <button
              className="paper-button paper-button-orange px-4 py-2 font-display text-xs font-black uppercase"
              type="button"
              onClick={() => setMockDeployState("success")}
            >
              Queue Deploy
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 px-4 py-6 md:px-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="grid gap-4 self-start">
          <WorkbenchPanel title="Agent Brain">
            <label className="paper-label mt-1 block text-on-surface-variant" htmlFor="brain-model">
              Model selector
            </label>
            <select
              aria-label="Brain Model"
              className="mt-2 w-full border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-bold text-on-surface"
              id="brain-model"
              value={brainModel}
              onChange={(event) => setBrainModel(event.target.value as (typeof brainModels)[number])}
            >
              {brainModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
            <div className="paper-inset mt-3 p-3 text-xs font-medium leading-5 text-on-surface-variant">
              High-speed inference with context windows tuned for rapid market execution.
            </div>
          </WorkbenchPanel>

          <WorkbenchPanel title="Logic Layer" headerClassName="bg-tertiary-container text-white">
            <p className="paper-label text-on-surface-variant">Primary strategy</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {strategies.map((option) => (
                <button
                  className={`border-2 border-outline-variant px-3 py-2 font-display text-[10px] font-black uppercase shadow-[2px_2px_0_#000] ${
                    strategy === option ? "bg-primary-container text-white" : "bg-surface-container-lowest text-on-surface-variant"
                  }`}
                  key={option}
                  type="button"
                  onClick={() => setStrategy(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </WorkbenchPanel>

          <WorkbenchPanel title="Risk Profile">
            <div className="grid gap-2">
              {riskProfiles.map((option) => (
                <button
                  className={`flex items-center justify-between border-2 border-outline-variant px-3 py-2 font-display text-[10px] font-black uppercase ${
                    riskProfile === option ? "bg-[#ffd7d2] text-error" : "bg-surface-container-lowest text-on-surface-variant"
                  }`}
                  key={option}
                  type="button"
                  onClick={() => setRiskProfile(option)}
                >
                  <span>{option}</span>
                  <span>{option === "Aggressive" ? "12.5%" : option === "Balanced" ? "8.0%" : "4.5%"}</span>
                </button>
              ))}
            </div>
          </WorkbenchPanel>

          <WorkbenchPanel title="Version History">
            <div className="grid gap-2 font-mono text-xs font-bold text-on-surface-variant">
              <div className="flex justify-between"><span>agent_771</span><span>24 sec</span></div>
              <div className="flex justify-between"><span>agent_770</span><span>50 sec</span></div>
              <div className="flex justify-between"><span>agent_769</span><span>10 min</span></div>
            </div>
          </WorkbenchPanel>
        </div>

        <div className="grid gap-5">
          <section className="paper-card overflow-hidden">
            <div className="flex items-center justify-between border-b-2 border-outline-variant bg-surface-container-low px-4 py-2">
              <h2 className="font-display text-sm font-black uppercase text-on-surface">Performance Backtest</h2>
              <div className="flex gap-2">
                {["7D", "30D", "MAX"].map((range, index) => (
                  <span className={`paper-chip px-2 py-1 ${index === 0 ? "paper-chip-blue" : ""}`} key={range}>
                    {range}
                  </span>
                ))}
              </div>
            </div>
            <div className="paper-grid relative min-h-[300px] p-5">
              <svg className="h-[260px] w-full" role="img" viewBox="0 0 760 260">
                <rect fill="transparent" height="260" width="760" />
                <rect fill="#ffdad6" height="155" opacity="0.75" width="52" x="280" y="72" />
                <rect fill="#ffdad6" height="125" opacity="0.75" width="52" x="590" y="102" />
                <polyline
                  fill="none"
                  points="10,220 70,196 120,204 180,172 235,186 290,128 340,156 390,104 445,134 500,82 555,98 610,48 665,70 735,22"
                  stroke="#2563eb"
                  strokeWidth="4"
                />
                {[
                  [390, 104, "Run Backtest"],
                  [500, 82, "Run Backtest"],
                  [610, 48, "Total Profit +24.8%"]
                ].map(([x, y, label], index) => (
                  <g key={`${String(label)}-${index}`}>
                    <rect fill="#2563eb" height="26" stroke="#000" strokeWidth="2" width={String(label).length * 8 + 28} x={Number(x)} y={Number(y) - 32} />
                    <text fill="#fff" fontFamily="Hanken Grotesk" fontSize="12" fontWeight="900" x={Number(x) + 12} y={Number(y) - 14}>
                      {label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <WorkbenchPanel title="On-chain Inputs">
              <div className="grid gap-2">
                {dataInputs.map((input) => {
                  const selected = selectedInputs.includes(input);
                  return (
                    <button
                      className="flex items-center justify-between text-left font-display text-xs font-black uppercase text-on-surface"
                      key={input}
                      type="button"
                      onClick={() =>
                        setSelectedInputs((current) =>
                          current.includes(input) ? current.filter((item) => item !== input) : [...current, input]
                        )
                      }
                    >
                      <span>{input}</span>
                      <span className={`h-4 w-4 border-2 border-outline-variant ${selected ? "bg-primary-container" : "bg-white"}`} />
                    </button>
                  );
                })}
              </div>
            </WorkbenchPanel>

            <WorkbenchPanel title="Social Sentience">
              {["X/Twitter Firehose", "Discord Alpha Streams", "Sentiment Multiplier"].map((label, index) => (
                <div className="mt-2 flex items-center justify-between font-display text-xs font-black uppercase text-on-surface" key={label}>
                  <span>{label}</span>
                  <span className={`h-4 w-4 border-2 border-outline-variant ${index !== 1 ? "bg-primary-container" : "bg-white"}`} />
                </div>
              ))}
            </WorkbenchPanel>
          </div>

          <section className="paper-card p-4">
            <p className="paper-label text-outline">System Persona Prompt</p>
            <div className="paper-inset mt-3 p-4 font-mono text-xs leading-6 text-on-surface">
              Act as a high-frequency volatility arbitrage specialist.
              <br />
              Priority: Capital preservation over yield.
              <br />
              Voice: Aggressive, data-driven, minimalist.
              <br />
              Constraint: Never hold positions longer than 120 seconds.
            </div>
            <div className="mt-3 space-y-2 text-sm font-medium text-on-surface-variant">
              <div>Preview Model: {previewSummary.model}</div>
              <div>Preview Strategy: {previewSummary.strategy}</div>
              <div>Preview Risk: {previewSummary.riskProfile}</div>
              <div>Preview Inputs: {previewSummary.inputs.join(", ") || "None selected"}</div>
            </div>
          </section>

          <div className="paper-card-sm flex flex-wrap items-center justify-between gap-3 p-4">
            <button
              className="paper-button paper-button-primary px-4 py-3 font-display text-xs font-black uppercase"
              type="button"
              onClick={onPreviewArena}
            >
              Preview in Arena
            </button>
            <button
              className="paper-button paper-button-orange px-4 py-3 font-display text-xs font-black uppercase"
              type="button"
              onClick={() => setMockDeployState("success")}
            >
              Deploy to Arena (Mock)
            </button>
            {mockDeployState === "success" ? (
              <p className="basis-full text-sm font-bold text-tertiary">Mock deploy queued for preview only. No real deployment occurred.</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkbenchPanel({
  children,
  headerClassName = "bg-surface-container-low text-on-surface",
  title
}: {
  children: ReactNode;
  headerClassName?: string;
  title: string;
}) {
  return (
    <section className="paper-card-sm overflow-hidden">
      <div className={`border-b-2 border-outline-variant px-3 py-2 ${headerClassName}`}>
        <h2 className="font-display text-xs font-black uppercase">{title}</h2>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}
