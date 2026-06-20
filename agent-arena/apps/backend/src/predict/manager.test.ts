import { describe, expect, it } from "bun:test";
import {
  discoverPredictManager,
  type InternalPredictManagerBinding,
  planManagerSetup,
  PredictManagerError
} from "./manager";

const walletAddress = "0xagentwallet";

describe("discoverPredictManager", () => {
  it("uses a local binding before server candidates and verifies owner onchain", async () => {
    const serverCalls: string[] = [];
    const verifyCalls: Array<{ managerId: string; walletAddress: string }> = [];
    const staleBindingAddress = "0xstaleagentwallet";

    const localBinding: InternalPredictManagerBinding = {
      id: "manager_binding_001",
      walletId: "wallet_internal_001",
      agentId: "agent_internal_001",
      address: staleBindingAddress,
      managerId: "0xlocal-manager",
      createdAt: "2026-06-17T00:00:00.000Z",
      status: "ready",
      lastCheckedAt: "2026-06-17T00:00:00.000Z"
    };

    const manager = await discoverPredictManager({
      walletAddress,
      localBinding,
      listServerManagers: async () => {
        serverCalls.push("server");
        return [{ manager_id: "0xserver-manager", owner: walletAddress }];
      },
      verifyManagerOwner: async (managerId, address) => {
        verifyCalls.push({ managerId, walletAddress: address });
        return true;
      }
    });

    expect(manager).toMatchObject({
      managerId: "0xlocal-manager",
      ownerAddress: walletAddress,
      address: walletAddress,
      source: "local",
      binding: localBinding
    });
    expect(manager?.binding).not.toHaveProperty("updatedAt");
    expect(serverCalls).toEqual([]);
    expect(verifyCalls).toEqual([
      { managerId: "0xlocal-manager", walletAddress }
    ]);
  });

  it("discovers a server candidate when no local binding exists and owner verifies", async () => {
    const manager = await discoverPredictManager({
      walletAddress,
      listServerManagers: async () => [
        { manager_id: "0xother-manager", owner: "0xother" },
        { manager_id: "0xserver-manager", owner: walletAddress }
      ],
      verifyManagerOwner: async (managerId, address) =>
        managerId === "0xserver-manager" && address === walletAddress
    });

    expect(manager).toEqual({
      managerId: "0xserver-manager",
      ownerAddress: walletAddress,
      address: walletAddress,
      source: "server"
    });
  });

  it("rejects a candidate when onchain owner verification mismatches", async () => {
    await expect(discoverPredictManager({
      walletAddress,
      listServerManagers: async () => [
        { manager_id: "0xserver-manager", owner: walletAddress }
      ],
      verifyManagerOwner: async () => false
    })).rejects.toMatchObject<PredictManagerError>({
      code: "MANAGER_OWNER_MISMATCH"
    });
  });

  it("discovers an event candidate from a nested parsed event payload", async () => {
    const verifyCalls: Array<{ managerId: string; walletAddress: string }> = [];

    const manager = await discoverPredictManager({
      walletAddress,
      listServerManagers: async () => ({ managers: [] }),
      listEventCandidates: async () => ({
        events: [
          {
            id: { id: "0xevent-envelope-not-manager" },
            type: "0xpredict::predict::PredictManagerCreated",
            parsedJson: {
              manager_id: { id: "0xevent-manager" },
              owner_address: walletAddress
            }
          }
        ]
      }),
      verifyManagerOwner: async (managerId, address) => {
        verifyCalls.push({ managerId, walletAddress: address });
        return managerId === "0xevent-manager" && address === walletAddress;
      }
    });

    expect(manager).toEqual({
      managerId: "0xevent-manager",
      ownerAddress: walletAddress,
      address: walletAddress,
      source: "event"
    });
    expect(verifyCalls).toEqual([
      { managerId: "0xevent-manager", walletAddress }
    ]);
  });

  it("returns null for no candidate without using wallet-owned object lookup", async () => {
    let ownedLookupCalled = false;
    let verifyCalled = false;

    const result = await discoverPredictManager({
      walletAddress,
      listServerManagers: async () => [],
      listEventCandidates: async () => [],
      verifyManagerOwner: async () => {
        verifyCalled = true;
        return true;
      },
      listOwnedObjectManagers: async () => {
        ownedLookupCalled = true;
        throw new Error("OWNED_OBJECT_LOOKUP_USED");
      }
    } as Parameters<typeof discoverPredictManager>[0] & {
      listOwnedObjectManagers: () => Promise<never>;
    });

    expect(result).toBeNull();
    expect(verifyCalled).toBe(false);
    expect(ownedLookupCalled).toBe(false);
  });
});

describe("planManagerSetup", () => {
  it("plans missing-manager dry-run as create-only with deposit blocked", () => {
    expect(planManagerSetup({
      manager: null,
      dryRunOnly: true,
      depositDusdcRaw: "5000000"
    })).toEqual({
      createManager: "dry_run_only",
      depositStatus: "blocked_until_manager_exists",
      depositDusdcRaw: "5000000"
    });
  });

  it("plans missing-manager submit as create required with positive deposit preserved but blocked", () => {
    expect(planManagerSetup({
      manager: null,
      dryRunOnly: false,
      depositDusdcRaw: "5000000"
    })).toEqual({
      createManager: "submit_required",
      depositStatus: "blocked_until_manager_exists",
      depositDusdcRaw: "5000000"
    });
  });

  it("allows deposit dry-run planning only when a manager exists", () => {
    const manager = {
      managerId: "0xmanager",
      ownerAddress: walletAddress,
      address: walletAddress,
      source: "server" as const
    };

    expect(planManagerSetup({
      manager,
      dryRunOnly: true,
      depositDusdcRaw: "5000000"
    })).toEqual({
      createManager: "skip",
      depositStatus: "ready_to_dry_run",
      managerId: "0xmanager",
      depositDusdcRaw: "5000000"
    });

    expect(planManagerSetup({
      manager,
      dryRunOnly: false,
      depositDusdcRaw: "0"
    })).toEqual({
      createManager: "skip",
      depositStatus: "not_requested",
      managerId: "0xmanager"
    });
  });

  it("rejects negative or fractional raw deposit amounts with a clear code", () => {
    const manager = {
      managerId: "0xmanager",
      ownerAddress: walletAddress,
      address: walletAddress,
      source: "server" as const
    };

    expect(() => planManagerSetup({
      manager,
      dryRunOnly: true,
      depositDusdcRaw: "-1"
    })).toThrow("INVALID_DEPOSIT_DUSDC_RAW");

    expect(() => planManagerSetup({
      manager,
      dryRunOnly: true,
      depositDusdcRaw: "1.5"
    })).toThrow("INVALID_DEPOSIT_DUSDC_RAW");
  });
});
