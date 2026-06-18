import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentClaimPanel, type ClaimWalletProvider } from "./AgentClaimPanel";

describe("AgentClaimPanel", () => {
  it("claims with the connected owner wallet address and signed claim message", async () => {
    const platformFetcher = vi.fn(async () => new Response(JSON.stringify({
      agent: {
        id: "agent_2050",
        displayName: "Claimed Agent",
        twitterHandle: null,
        twitterVerified: false,
        ownerAddress: "0xowner",
        tradingWalletAddress: "0xwallet",
        runtimeStatus: "active",
        exposureStatus: "flat",
        createdAt: "2026-06-18T02:00:00.000Z"
      },
      tradingWallet: {
        id: "wallet_2050",
        agentId: "agent_2050",
        address: "0xwallet",
        status: "active",
        testnetSuiBalance: "0",
        quoteBalance: "0",
        predictManagerStatus: "missing",
        predictManagerId: null
      },
      runtimeCredential: {
        token: "agent_runtime_claimed",
        shownOnce: true,
        scopes: ["competition:read"]
      }
    }), {
      status: 201,
      headers: { "content-type": "application/json" }
    }));
    const walletProvider: ClaimWalletProvider = {
      connect: vi.fn(async () => ({ accounts: [{ address: "0xowner" }] })),
      signPersonalMessage: vi.fn(async () => ({ signature: "0xsigned-owner-claim" }))
    };

    render(
      <AgentClaimPanel
        apiBaseUrl="http://127.0.0.1:8787/api/arena"
        fetcher={platformFetcher}
        registrationCode="PAIR-2050"
        walletProvider={walletProvider}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Connect wallet and claim/i }));

    expect(await screen.findByText("agent_runtime_claimed")).toBeInTheDocument();
    expect(walletProvider.connect).toHaveBeenCalled();
    expect(walletProvider.signPersonalMessage).toHaveBeenCalled();
    await waitFor(() => {
      expect(platformFetcher).toHaveBeenCalledWith("http://127.0.0.1:8787/api/arena/owner/agents/claim", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          registrationCode: "PAIR-2050",
          ownerAddress: "0xowner",
          signature: "0xsigned-owner-claim"
        })
      }));
    });
  });

  it("claims through a Sui wallet permission request when connect is unavailable", async () => {
    const platformFetcher = vi.fn(async () => new Response(JSON.stringify({
      agent: {
        id: "agent_2051",
        displayName: "Claimed Agent",
        twitterHandle: null,
        twitterVerified: false,
        ownerAddress: "0xowner_permissioned",
        tradingWalletAddress: "0xwallet",
        runtimeStatus: "active",
        exposureStatus: "flat",
        createdAt: "2026-06-18T02:00:00.000Z"
      },
      tradingWallet: {
        id: "wallet_2051",
        agentId: "agent_2051",
        address: "0xwallet",
        status: "active",
        testnetSuiBalance: "0",
        quoteBalance: "0",
        predictManagerStatus: "missing",
        predictManagerId: null
      },
      runtimeCredential: {
        token: "agent_runtime_permissioned",
        shownOnce: true,
        scopes: ["competition:read"]
      }
    }), {
      status: 201,
      headers: { "content-type": "application/json" }
    }));
    const walletProvider: ClaimWalletProvider = {
      requestPermissions: vi.fn(async () => undefined),
      getAccounts: vi.fn(async () => [{ address: "0xowner_permissioned" }]),
      signPersonalMessage: vi.fn(async () => ({ signature: "0xsigned-permissioned-claim" }))
    };

    render(
      <AgentClaimPanel
        apiBaseUrl="http://127.0.0.1:8787/api/arena"
        fetcher={platformFetcher}
        registrationCode="PAIR-2051"
        walletProvider={walletProvider}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Connect wallet and claim/i }));

    expect(await screen.findByText("agent_runtime_permissioned")).toBeInTheDocument();
    expect(walletProvider.requestPermissions).toHaveBeenCalledWith(["viewAccount"]);
    await waitFor(() => {
      expect(platformFetcher).toHaveBeenCalledWith("http://127.0.0.1:8787/api/arena/owner/agents/claim", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          registrationCode: "PAIR-2051",
          ownerAddress: "0xowner_permissioned",
          signature: "0xsigned-permissioned-claim"
        })
      }));
    });
  });

  it("claims with the real owner address from a wallet option", async () => {
    const platformFetcher = vi.fn(async () => new Response(JSON.stringify({
      agent: {
        id: "agent_2052",
        displayName: "Claimed Agent",
        twitterHandle: null,
        twitterVerified: false,
        ownerAddress: "0xreal_owner",
        tradingWalletAddress: "0xinternal_trading_wallet",
        runtimeStatus: "active",
        exposureStatus: "flat",
        createdAt: "2026-06-18T02:00:00.000Z"
      },
      tradingWallet: {
        id: "wallet_internal_2052",
        agentId: "agent_2052",
        address: "0xinternal_trading_wallet",
        status: "active",
        testnetSuiBalance: "0",
        quoteBalance: "0",
        predictManagerStatus: "missing",
        predictManagerId: null
      },
      runtimeCredential: {
        token: "agent_runtime_wallet_standard",
        shownOnce: true,
        scopes: ["competition:read"]
      }
    }), {
      status: 201,
      headers: { "content-type": "application/json" }
    }));
    const connect = vi.fn(async () => ({
      accounts: [{
        address: "0xreal_owner",
        publicKey: new Uint8Array([1, 2, 3]),
        chains: ["sui:testnet"],
        features: ["sui:signPersonalMessage"]
      }]
    }));
    const signPersonalMessage = vi.fn(async (_input: { message: Uint8Array; account?: { address: string } }) => ({
      signature: "0xreal-owner-signature"
    }));
    render(
      <AgentClaimPanel
        apiBaseUrl="http://127.0.0.1:8787/api/arena"
        fetcher={platformFetcher}
        registrationCode="PAIR-2052"
        walletOptions={[{
          id: "sdk:sui-wallet",
          name: "Sui Wallet",
          provider: {
            connect,
            signPersonalMessage
          }
        }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Connect wallet and claim/i }));

    expect(screen.getByRole("dialog", { name: /Connect owner wallet/i })).toBeInTheDocument();
    expect(connect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sui Wallet" }));
    expect(await screen.findByText("agent_runtime_wallet_standard")).toBeInTheDocument();
    expect(screen.getByText("Owner wallet 0xreal_owner")).toBeInTheDocument();
    expect(screen.getByText("Trading wallet 0xinternal_trading_wallet")).toBeInTheDocument();
    expect(connect).toHaveBeenCalled();
    const signInput = signPersonalMessage.mock.calls[0]?.[0];
    expect(signInput).toMatchObject({
      account: expect.objectContaining({ address: "0xreal_owner" })
    });
    expect(ArrayBuffer.isView(signInput?.message)).toBe(true);
    await waitFor(() => {
      expect(platformFetcher).toHaveBeenCalledWith("http://127.0.0.1:8787/api/arena/owner/agents/claim", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          registrationCode: "PAIR-2052",
          ownerAddress: "0xreal_owner",
          signature: "0xreal-owner-signature"
        })
      }));
    });
  });
});
