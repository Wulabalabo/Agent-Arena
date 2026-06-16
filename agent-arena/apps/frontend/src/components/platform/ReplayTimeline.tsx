import type { ReactNode } from "react";
import type { ReplayEvent } from "../../features/platform/types";

interface ReplayTimelineProps {
  events: ReplayEvent[];
}

export function ReplayTimeline({ events }: ReplayTimelineProps) {
  const sortedEvents = [...events].sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  return (
    <section aria-label="Replay" className="paper-card-sm p-4">
      <div>
        <p className="paper-label text-on-surface-variant">Replay</p>
        <h2 className="mt-1 font-display text-lg font-black uppercase text-on-surface">Intent to Predict proof chain</h2>
      </div>

      <div className="mt-3 space-y-2">
        {sortedEvents.length > 0 ? (
          sortedEvents.map((event) => (
            <article className="paper-inset p-3" key={event.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="paper-label text-on-surface-variant">{formatTimestamp(event.timestamp)}</p>
                  <h3 className="mt-1 font-display text-sm font-black uppercase text-on-surface">{event.label}</h3>
                  <p className="mt-2 text-xs font-semibold leading-5 text-on-surface-variant">{event.summary}</p>
                </div>
                <span className="paper-chip shrink-0 px-2 py-1">{event.recordId}</span>
              </div>
              <p className="mt-3 break-all font-mono text-[11px] font-bold text-on-surface-variant">
                Copy value: {event.copyValue ?? "none"} / Predict tx digest: {event.txDigest ?? "not submitted"}
              </p>
            </article>
          ))
        ) : (
          <EmptyState>No replay events yet.</EmptyState>
        )}
      </div>
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="paper-inset p-3 text-sm font-semibold text-on-surface-variant">{children}</p>;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short"
  });
}
