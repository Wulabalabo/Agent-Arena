import type { ActionReadinessStatus, AgentReadiness } from "../../features/platform/types";

interface AgentReadinessPanelProps {
  readiness: AgentReadiness;
}

const actionOrder = ["hold", "open_directional", "open_range", "reduce", "close"] as const;

export function AgentReadinessPanel({ readiness }: AgentReadinessPanelProps) {
  return (
    <section aria-label="Agent action readiness" className="grid gap-2 border-t-2 border-outline-variant pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="paper-label text-on-surface-variant">Action readiness</p>
          <p className="mt-1 break-all font-mono text-[11px] font-bold text-on-surface-variant">
            {readiness.competitionId}
          </p>
        </div>
        <span className="paper-chip shrink-0 px-2 py-1">as of {readiness.asOfMs}</span>
      </div>

      <div className="grid gap-2">
        {actionOrder.map((action) => {
          const actionReadiness = readiness.actions[action];

          return (
            <article className="paper-inset min-w-0 p-2" key={action}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="break-all font-mono text-xs font-black text-on-surface">{action}</p>
                <span className={`paper-chip shrink-0 px-2 py-1 ${statusChipClass(actionReadiness.status)}`}>
                  {actionReadiness.status}
                </span>
              </div>

              {actionReadiness.markets?.length ? (
                <div className="mt-2 flex min-w-0 flex-wrap gap-1">
                  {actionReadiness.markets.map((market) => (
                    <span className="paper-chip min-w-0 max-w-full break-all px-2 py-1" key={market}>
                      {market}
                    </span>
                  ))}
                </div>
              ) : null}

              {actionReadiness.reasons.length ? (
                <ul className="mt-2 grid gap-1 text-[11px] font-bold text-on-surface-variant">
                  {actionReadiness.reasons.map((reason) => (
                    <li className="min-w-0" key={`${action}-${reason.code}`}>
                      <code className="break-all font-mono text-on-surface">{reason.code}</code>
                      <span className="mx-1 text-on-surface-variant">-</span>
                      <span className="break-words">{reason.message}</span>
                      <span className="ml-1 break-words text-on-surface">
                        rec {reason.recommendedAgentAction}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function statusChipClass(status: ActionReadinessStatus): string {
  if (status === "executable") {
    return "paper-chip-green";
  }

  if (status === "blocked") {
    return "paper-chip-red";
  }

  return "paper-chip-orange";
}
