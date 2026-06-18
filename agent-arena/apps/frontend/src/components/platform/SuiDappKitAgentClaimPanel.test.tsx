import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuiDappKitAgentClaimPanel } from "./SuiDappKitAgentClaimPanel";

const dappKitState = vi.hoisted(() => ({
  account: null as { address: string } | null,
  signPersonalMessage: vi.fn()
}));

vi.mock("@mysten/dapp-kit-react", () => ({
  useCurrentAccount: () => dappKitState.account,
  useDAppKit: () => ({
    signPersonalMessage: dappKitState.signPersonalMessage
  })
}));

describe("SuiDappKitAgentClaimPanel", () => {
  beforeEach(() => {
    dappKitState.account = null;
    dappKitState.signPersonalMessage.mockReset();
  });

  it("claims with the globally connected owner wallet without opening a page wallet selector", async () => {
    const platformFetcher = vi.fn(async () => new Response(JSON.stringify({
      agent: {
        id: "agent_sdk",
        displayName: "Claimed Agent",
        twitterHandle: null,
        twitterVerified: false,
        ownerAddress: "0xsdk_owner",
        tradingWalletAddress: "0xinternal_trading_wallet",
        runtimeStatus: "active",
        exposureStatus: "flat",
        createdAt: "2026-06-18T02:00:00.000Z"
      },
      tradingWallet: {
        id: "wallet_sdk",
        agentId: "agent_sdk",
        address: "0xinternal_trading_wallet",
        status: "active",
        testnetSuiBalance: "0",
        quoteBalance: "0",
        predictManagerStatus: "ready",
        predictManagerId: "pm_sdk"
      },
      runtimeCredential: {
        token: "agent_runtime_sdk",
        shownOnce: true,
        scopes: ["competition:read"]
      }
    }), {
      status: 201,
      headers: { "content-type": "application/json" }
    }));
    dappKitState.account = { address: "0xsdk_owner" };
    dappKitState.signPersonalMessage.mockResolvedValue({
      signature: "0xsdk_signature"
    });

    render(
      <SuiDappKitAgentClaimPanel
        apiBaseUrl="http://127.0.0.1:8787/api/arena"
        fetcher={platformFetcher}
        registrationCode="PAIR-2054"
      />
    );

    expect(screen.getByText("0xsdk_owner")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Claim$/i }));

    expect(await screen.findByText("agent_runtime_sdk")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /Connect owner wallet/i })).not.toBeInTheDocument();
    const signInput = dappKitState.signPersonalMessage.mock.calls[0]?.[0];
    expect(signInput).toMatchObject({
      account: expect.objectContaining({ address: "0xsdk_owner" })
    });
    expect(ArrayBuffer.isView(signInput?.message)).toBe(true);
    await waitFor(() => {
      expect(platformFetcher).toHaveBeenCalledWith("http://127.0.0.1:8787/api/arena/owner/agents/claim", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          registrationCode: "PAIR-2054",
          ownerAddress: "0xsdk_owner",
          signature: "0xsdk_signature"
        })
      }));
    });
  });

  it("requires the global menu wallet before claiming and never shows manual owner entry", () => {
    render(
      <SuiDappKitAgentClaimPanel
        apiBaseUrl="http://127.0.0.1:8787/api/arena"
        registrationCode="PAIR-2055"
      />
    );

    expect(screen.queryByLabelText(/Owner wallet address/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Connect owner wallet in the top menu/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Claim$/i })).toBeDisabled();
  });
});
