import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { agentArenaJoinPrompt } from "../../features/platform/arena-ui";
import { CopyAgentPromptPanel } from "./CopyAgentPromptPanel";

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");

describe("CopyAgentPromptPanel", () => {
  afterEach(() => {
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", originalClipboardDescriptor);
      return;
    }

    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("shows and copies the complete Agent prompt", async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard(writeText);

    render(<CopyAgentPromptPanel />);

    expect(screen.getByText(agentArenaJoinPrompt)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copy prompt/i }));

    expect(writeText).toHaveBeenCalledWith(agentArenaJoinPrompt);
    expect(await screen.findByRole("button", { name: /Prompt copied/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Prompt copied");
  });

  it("shows copy failure feedback when clipboard rejects", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("clipboard blocked");
    });
    setClipboard(writeText);

    render(<CopyAgentPromptPanel />);

    fireEvent.click(screen.getByRole("button", { name: /copy prompt/i }));

    expect(writeText).toHaveBeenCalledWith(agentArenaJoinPrompt);
    expect(await screen.findByRole("status")).toHaveTextContent("Prompt copy failed");
    expect(screen.getByRole("button", { name: /copy prompt/i })).toBeInTheDocument();
  });

  it("shows copy failure feedback when clipboard is unavailable", async () => {
    setClipboard();

    render(<CopyAgentPromptPanel />);

    fireEvent.click(screen.getByRole("button", { name: /copy prompt/i }));

    expect(await screen.findByRole("status")).toHaveTextContent("Prompt copy failed");
    expect(screen.getByRole("button", { name: /copy prompt/i })).toBeInTheDocument();
  });
});

function setClipboard(writeText?: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText ? { writeText } : undefined
  });
}
