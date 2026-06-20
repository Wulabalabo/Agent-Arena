import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SuiDappKitAgentClaimPanel } from "./SuiDappKitAgentClaimPanel";

const dappKitState = vi.hoisted(() => ({
  account: null as { address: string } | null,
  signAndExecuteTransaction: vi.fn()
}));

const sdkOwnerAddress = "0x0000000000000000000000000000000000000000000000000000000000000ace";
const sdkTradingWalletAddress = "0x0000000000000000000000000000000000000000000000000000000000000fed";

vi.mock("@mysten/dapp-kit-react", () => ({
  useCurrentAccount: () => dappKitState.account,
  useDAppKit: () => ({
    signAndExecuteTransaction: dappKitState.signAndExecuteTransaction
  })
}));

describe("SuiDappKitAgentClaimPanel", () => {
  beforeEach(() => {
    dappKitState.account = null;
    dappKitState.signAndExecuteTransaction.mockReset();
  });

  it("claims with the globally connected owner wallet by executing the registry transaction", async () => {
    const platformFetcher = createClaimFetcher({
      pendingClaimId: "pending_claim_sdk",
      agentId: "agent_sdk",
      ownerAddress: sdkOwnerAddress,
      walletId: "wallet_sdk",
      walletAddress: sdkTradingWalletAddress,
      token: "agent_runtime_sdk",
      txDigest: "0xsdkdigest"
    });
    dappKitState.account = { address: sdkOwnerAddress };
    dappKitState.signAndExecuteTransaction.mockResolvedValue({
      digest: "0xsdkdigest"
    });

    render(
      <SuiDappKitAgentClaimPanel
        apiBaseUrl="http://127.0.0.1:8787/api/arena"
        fetcher={platformFetcher}
        registrationCode="PAIR-2054"
      />
    );

    expect(screen.getByText(sdkOwnerAddress)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Claim$/i }));

    expect(await screen.findByText("agent_runtime_sdk")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /Connect owner wallet/i })).not.toBeInTheDocument();
    expect(dappKitState.signAndExecuteTransaction).toHaveBeenCalledWith({
      transaction: expect.objectContaining({
        getData: expect.any(Function)
      })
    });
    await waitFor(() => {
      expect(platformFetcher).toHaveBeenCalledWith("http://127.0.0.1:8787/api/arena/owner/agents/claim/prepare", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          registrationCode: "PAIR-2054",
          ownerAddress: sdkOwnerAddress
        })
      }));
      expect(platformFetcher).toHaveBeenCalledWith("http://127.0.0.1:8787/api/arena/owner/agents/claim/finalize", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          pendingClaimId: "pending_claim_sdk",
          txDigest: "0xsdkdigest"
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

function createClaimFetcher(input: {
  pendingClaimId: string;
  agentId: string;
  ownerAddress: string;
  walletId: string;
  walletAddress: string;
  token: string;
  txDigest: string;
}) {
  return vi.fn(async (url: string) => {
    if (url.endsWith("/owner/agents/claim/prepare")) {
      return new Response(JSON.stringify({
        pendingClaimId: input.pendingClaimId,
        agent: agent(input.agentId, input.ownerAddress, input.walletAddress),
        tradingWallet: tradingWallet(input.walletId, input.agentId, input.walletAddress),
        registryProof: {
          kind: "register_agent",
          packageId: "0x0000000000000000000000000000000000000000000000000000000000000abc",
          registryObjectId: "0x0000000000000000000000000000000000000000000000000000000000000def",
          agentId: input.agentId,
          ownerAddress: input.ownerAddress,
          tradingWalletAddress: input.walletAddress,
          metadataHash: "sha256:metadata",
          nonceBase64: "bm9uY2U=",
          signatureBase64: "c2lnbmF0dXJl"
        }
      }), {
        status: 201,
        headers: { "content-type": "application/json" }
      });
    }

    if (url.endsWith("/owner/agents/claim/finalize")) {
      return new Response(JSON.stringify({
        agent: agent(input.agentId, input.ownerAddress, input.walletAddress),
        tradingWallet: tradingWallet(input.walletId, input.agentId, input.walletAddress),
        runtimeCredential: {
          token: input.token,
          shownOnce: true,
          scopes: ["competition:read"]
        },
        registry: {
          status: "submitted",
          txDigest: input.txDigest
        }
      }), {
        status: 201,
        headers: { "content-type": "application/json" }
      });
    }

    throw new Error(`Unexpected URL ${url}`);
  });
}

function agent(id: string, ownerAddress: string, tradingWalletAddress: string) {
  return {
    id,
    displayName: "Claimed Agent",
    twitterHandle: null,
    twitterVerified: false,
    ownerAddress,
    tradingWalletAddress,
    runtimeStatus: "active",
    exposureStatus: "flat",
    createdAt: "2026-06-18T02:00:00.000Z"
  };
}

function tradingWallet(id: string, agentId: string, address: string) {
  return {
    id,
    agentId,
    address,
    status: "active",
    testnetSuiBalance: "0",
    quoteBalance: "0",
    predictManagerStatus: "ready",
    predictManagerId: "pm_sdk"
  };
}
