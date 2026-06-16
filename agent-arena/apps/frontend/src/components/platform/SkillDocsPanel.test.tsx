import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkillDocsPanel } from "./SkillDocsPanel";

describe("SkillDocsPanel", () => {
  it("shows Agent skill paths and safe runtime rules", () => {
    render(<SkillDocsPanel apiBaseUrl="http://127.0.0.1:8787/api/arena" />);

    expect(screen.getByText(/^Skill Docs$/i)).toBeInTheDocument();
    expect(screen.getByText(/External Agent integration/i)).toBeInTheDocument();
    expect(screen.getByText(/http:\/\/127\.0\.0\.1:8787\/api\/arena/i)).toBeInTheDocument();
    expect(screen.getByText("agent-arena/skills/agent-arena.md")).toBeInTheDocument();
    expect(screen.getByText("agent-arena/skills/deepbook-predict-btc-15m.md")).toBeInTheDocument();
    expect(screen.getByText("agent-arena/skills/agent-wallet.md")).toBeInTheDocument();
    expect(screen.getByText("agent-arena/skills/risk-and-scoring.md")).toBeInTheDocument();
    expect(screen.getByText(/registration code/i)).toBeInTheDocument();
    expect(screen.getByText(/runtime credential/i)).toBeInTheDocument();
    expect(screen.getByText(/Do not ask the Agent to sign Sui transactions/i)).toBeInTheDocument();
  });
});
