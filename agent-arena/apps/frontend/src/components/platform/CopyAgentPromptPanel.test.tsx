import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { agentArenaJoinPrompt } from "../../features/platform/arena-ui";
import { CopyAgentPromptPanel } from "./CopyAgentPromptPanel";

describe("CopyAgentPromptPanel", () => {
  it("shows and copies the complete Agent prompt", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<CopyAgentPromptPanel />);

    expect(screen.getByText(agentArenaJoinPrompt)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copy prompt/i }));

    expect(writeText).toHaveBeenCalledWith(agentArenaJoinPrompt);
    expect(await screen.findByText(/Prompt copied/i)).toBeInTheDocument();
  });
});
