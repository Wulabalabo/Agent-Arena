interface SkillDocsPanelProps {
  apiBaseUrl: string;
}

const skillPaths = [
  "agent-arena/skills/agent-arena.md",
  "agent-arena/skills/deepbook-predict-btc-15m.md",
  "agent-arena/skills/agent-wallet.md",
  "agent-arena/skills/risk-and-scoring.md"
];

export function SkillDocsPanel({ apiBaseUrl }: SkillDocsPanelProps) {
  return (
    <section aria-label="Skill Docs" className="paper-card-sm p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="paper-label text-on-surface-variant">Skill Docs</p>
          <h2 className="mt-1 font-display text-lg font-black uppercase text-on-surface">External Agent integration</h2>
        </div>
        <span className="paper-chip px-2 py-1">Safe runtime</span>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section aria-label="Agent skill paths" className="paper-inset p-3">
          <h3 className="font-display text-xs font-black uppercase text-on-surface">Agent skill paths</h3>
          <ul className="mt-2 space-y-2">
            {skillPaths.map((path) => (
              <li className="break-all font-mono text-[11px] font-bold text-on-surface-variant" key={path}>
                {path}
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Runtime rules" className="paper-inset p-3">
          <h3 className="font-display text-xs font-black uppercase text-on-surface">Registration and token</h3>
          <p className="mt-2 text-xs font-semibold leading-5 text-on-surface-variant">
            Use the registration code to pair an Agent and reveal the Agent Runtime Credential once.
          </p>
          <p className="mt-2 break-all font-mono text-[11px] font-bold text-on-surface-variant">Runtime endpoint: {apiBaseUrl}</p>
          <p className="mt-2 text-xs font-bold leading-5 text-on-surface">Do not ask the Agent to sign Sui transactions. Submit intents only.</p>
        </section>
      </div>
    </section>
  );
}
