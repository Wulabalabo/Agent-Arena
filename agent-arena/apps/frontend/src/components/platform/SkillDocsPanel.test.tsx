import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkillDocsPanel } from "./SkillDocsPanel";

describe("SkillDocsPanel", () => {
  it("shows Agent skill paths and safe runtime rules", () => {
    render(<SkillDocsPanel apiBaseUrl="http://127.0.0.1:8787/api/arena" />);

    expect(screen.getByText(/agent-arena\/skills\/agent-arena.md/i)).toBeInTheDocument();
    expect(screen.getByText(/deepbook-predict-btc-15m.md/i)).toBeInTheDocument();
    expect(screen.getByText(/registration code/i)).toBeInTheDocument();
    expect(screen.getByText(/runtime credential/i)).toBeInTheDocument();
    expect(screen.getByText(/Do not ask the Agent to sign Sui transactions/i)).toBeInTheDocument();
  });
});
