import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentClaimPanel, type ClaimWalletProvider } from "./AgentClaimPanel";

const ownerAddress = "0x0000000000000000000000000000000000000000000000000000000000000bad";
const tradingWalletAddress = "0x0000000000000000000000000000000000000000000000000000000000000bee";
const permissionedOwnerAddress = "0x000000000000000000000000000000000000000000000000000000000000cafe";
const permissionedWalletAddress = "0x000000000000000000000000000000000000000000000000000000000000f00d";
const realOwnerAddress = "0x0000000000000000000000000000000000000000000000000000000000000123";
const realTradingWalletAddress = "0x0000000000000000000000000000000000000000000000000000000000000456";

const registerProof = {
  kind: "register_agent",
  packageId: "0x0000000000000000000000000000000000000000000000000000000000000abc",
  registryObjectId: "0x0000000000000000000000000000000000000000000000000000000000000def",
  agentId: "agent_2050",
  ownerAddress,
  tradingWalletAddress,
  metadataHash: "sha256:metadata",
  nonceBase64: "bm9uY2U=",
  signatureBase64: "c2lnbmF0dXJl"
};

describe("AgentClaimPanel", () => {
  it("claims with one owner registry transaction and reveals the runtime credential only after finalize", async () => {
    const writeText = vi.fn(async (_text: string) => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    const finalizeGate = createDeferred<Response>();
    const platformFetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/owner/agents/claim/prepare")) {
        return new Response(JSON.stringify({
          pendingClaimId: "pending_claim_2050",
          agent: agent("agent_2050", ownerAddress, tradingWalletAddress),
          tradingWallet: tradingWallet("wallet_2050", "agent_2050", tradingWalletAddress),
          registryProof: registerProof
        }), {
          status: 201,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/owner/agents/claim/finalize")) {
        return await finalizeGate.promise;
      }

      throw new Error(`Unexpected URL ${url}`);
    });
    const walletProvider: ClaimWalletProvider = {
      connect: vi.fn(async () => ({ accounts: [{ address: ownerAddress }] })),
      signAndExecuteTransaction: vi.fn(async () => ({ digest: "0xclaimdigest" }))
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

    await waitFor(() => {
      expect(walletProvider.signAndExecuteTransaction).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("agent_runtime_claimed")).not.toBeInTheDocument();
    expect(platformFetcher).toHaveBeenCalledWith("http://127.0.0.1:8787/api/arena/owner/agents/claim/prepare", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        registrationCode: "PAIR-2050",
        ownerAddress
      })
    }));
    expect(walletProvider.signAndExecuteTransaction).toHaveBeenCalledWith({
      transaction: expect.objectContaining({
        getData: expect.any(Function)
      })
    });

    finalizeGate.resolve(new Response(JSON.stringify({
      agent: agent("agent_2050", ownerAddress, tradingWalletAddress),
      tradingWallet: tradingWallet("wallet_2050", "agent_2050", tradingWalletAddress),
      runtimeCredential: {
        token: "agent_runtime_claimed",
        shownOnce: true,
        scopes: ["competition:read"]
      },
      registry: {
        status: "submitted",
        txDigest: "0xclaimdigest"
      }
    }), {
      status: 201,
      headers: { "content-type": "application/json" }
    }));

    expect(await screen.findByText("agent_runtime_claimed")).toBeInTheDocument();
    expect(screen.getByText("Registry tx 0xclaimdigest")).toBeInTheDocument();
    await waitFor(() => {
      expect(platformFetcher).toHaveBeenCalledWith("http://127.0.0.1:8787/api/arena/owner/agents/claim/finalize", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          pendingClaimId: "pending_claim_2050",
          txDigest: "0xclaimdigest"
        })
      }));
    });
    fireEvent.click(screen.getByRole("button", { name: /Copy Agent handoff/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    const handoff = JSON.parse(writeText.mock.calls[0]?.[0] ?? "{}");
    expect(handoff).toMatchObject({
      baseUrl: "http://127.0.0.1:8787/api/arena",
      agentId: "agent_2050",
      token: "agent_runtime_claimed",
      scopes: ["competition:read"],
      tradingWalletId: "wallet_2050",
      walletAddress: tradingWalletAddress,
      predictManagerId: null
    });
  });

  it("prepares the claim with an account loaded through Sui wallet permissions", async () => {
    const platformFetcher = createImmediateClaimFetcher({
      pendingClaimId: "pending_claim_2051",
      agentId: "agent_2051",
      ownerAddress: permissionedOwnerAddress,
      walletId: "wallet_2051",
      walletAddress: permissionedWalletAddress,
      token: "agent_runtime_permissioned",
      txDigest: "0xpermissioneddigest"
    });
    const walletProvider: ClaimWalletProvider = {
      requestPermissions: vi.fn(async () => undefined),
      getAccounts: vi.fn(async () => [{ address: permissionedOwnerAddress }]),
      signAndExecuteTransaction: vi.fn(async () => ({ effects: { transactionDigest: "0xpermissioneddigest" } }))
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
    expect(walletProvider.signAndExecuteTransaction).toHaveBeenCalledTimes(1);
    expect(platformFetcher).toHaveBeenCalledWith("http://127.0.0.1:8787/api/arena/owner/agents/claim/prepare", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        registrationCode: "PAIR-2051",
        ownerAddress: permissionedOwnerAddress
      })
    }));
  });

  it("claims with the real owner address from a wallet option", async () => {
    const platformFetcher = createImmediateClaimFetcher({
      pendingClaimId: "pending_claim_2052",
      agentId: "agent_2052",
      ownerAddress: realOwnerAddress,
      walletId: "wallet_internal_2052",
      walletAddress: realTradingWalletAddress,
      token: "agent_runtime_wallet_standard",
      txDigest: "0xoptiondigest"
    });
    const connect = vi.fn(async () => ({
      accounts: [{
        address: realOwnerAddress,
        publicKey: new Uint8Array([1, 2, 3]),
        chains: ["sui:testnet"],
        features: ["sui:signAndExecuteTransaction"]
      }]
    }));
    const signAndExecuteTransaction = vi.fn(async () => ({ Transaction: { digest: "0xoptiondigest" } }));

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
            signAndExecuteTransaction
          }
        }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Connect wallet and claim/i }));

    expect(screen.getByRole("dialog", { name: /Connect owner wallet/i })).toBeInTheDocument();
    expect(connect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sui Wallet" }));
    expect(await screen.findByText("agent_runtime_wallet_standard")).toBeInTheDocument();
    expect(screen.getByText(`Owner wallet ${realOwnerAddress}`)).toBeInTheDocument();
    expect(screen.getByText(`Trading wallet ${realTradingWalletAddress}`)).toBeInTheDocument();
    expect(connect).toHaveBeenCalled();
    expect(signAndExecuteTransaction).toHaveBeenCalledWith({
      transaction: expect.objectContaining({
        getData: expect.any(Function)
      })
    });
  });
});

function createImmediateClaimFetcher(input: {
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
          ...registerProof,
          agentId: input.agentId,
          ownerAddress: input.ownerAddress,
          tradingWalletAddress: input.walletAddress
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
    predictManagerStatus: "missing",
    predictManagerId: null
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}
