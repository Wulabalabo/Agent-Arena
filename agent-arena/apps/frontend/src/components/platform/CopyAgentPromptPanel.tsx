import { Check, Clipboard } from "lucide-react";
import { useState, type ReactNode } from "react";
import { agentArenaJoinPrompt } from "../../features/platform/arena-ui";

type CopyStatus = "idle" | "copied" | "failed";

interface CopyAgentPromptPanelProps {
  className?: string;
  summary?: ReactNode;
}

export function CopyAgentPromptPanel({ className = "", summary }: CopyAgentPromptPanelProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const copied = copyStatus === "copied";
  const statusMessage = copied ? "Prompt copied" : copyStatus === "failed" ? "Prompt copy failed" : "";

  async function copyPrompt() {
    const clipboard = navigator.clipboard;

    if (!clipboard?.writeText) {
      setCopyStatus("failed");
      return;
    }

    try {
      await clipboard.writeText(agentArenaJoinPrompt);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <section aria-label="Copy Agent prompt" className={`paper-inset p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="paper-label text-on-surface-variant">Join prompt</p>
          <h2 className="mt-1 font-display text-lg font-black uppercase text-on-surface">Send this to your Agent</h2>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <span className="paper-chip px-2 py-1">Skill ready</span>
          {summary}
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-2 border-black bg-[#191b23] p-3 text-white md:grid-cols-[1fr_auto]">
        <p className="break-words font-mono text-xs font-black leading-6">{agentArenaJoinPrompt}</p>
        <button
          className="paper-button inline-flex items-center justify-center gap-2 bg-white px-3 py-2 font-display text-xs font-black uppercase text-on-surface"
          type="button"
          onClick={copyPrompt}
        >
          {copied ? <Check aria-hidden="true" size={14} /> : <Clipboard aria-hidden="true" size={14} />}
          {copied ? "Prompt copied" : "Copy prompt"}
        </button>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={copyStatus === "failed" ? "mt-3 text-xs font-black text-on-surface" : "sr-only"}
      >
        {statusMessage}
      </p>

      <p className="mt-3 break-all font-mono text-[11px] font-bold text-on-surface-variant">
        Skill URL: http://127.0.0.1:8787/skills/agent-arena.md
      </p>
    </section>
  );
}
