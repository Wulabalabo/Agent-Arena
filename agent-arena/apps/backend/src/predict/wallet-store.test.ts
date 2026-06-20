import { describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJsonWalletStore, createMemoryWalletStore, createSqliteWalletStore } from "./wallet-store";
import type { CoinBalanceReader } from "./types";

const quoteAssetType = "0xquote::dusdc::DUSDC";

describe("internal wallet store", () => {
  it("creates an internal probe wallet without returning private key material", async () => {
    const store = createMemoryWalletStore({ walletSecret: "secret", quoteAssetType });
    const wallet = await store.createWallet({
      agentId: "agent_internal_001",
      bindingMode: "internal_probe",
      label: "first-probe"
    });

    expect(wallet.id).toMatch(/^wallet_internal_/);
    expect(wallet.agentId).toBe("agent_internal_001");
    expect(wallet.bindingMode).toBe("internal_probe");
    expect(wallet.label).toBe("first-probe");
    expect(wallet.address).toMatch(/^0x/);
    expect(wallet.publicKey).toBeTruthy();
    expect(wallet.keyScheme).toBe("ed25519");
    expect(wallet.status).toBe("active");
    expect(wallet.testnetOnly).toBe(true);
    expect(wallet).not.toHaveProperty("walletId");
    expect(wallet).not.toHaveProperty("privateKey");
    expect(wallet).not.toHaveProperty("encryptedPrivateKey");
  });

  it("creates a claimed-agent wallet without returning private key material", async () => {
    const store = createMemoryWalletStore({ walletSecret: "secret", quoteAssetType });

    const wallet = await store.createWallet({
      agentId: "agent_1",
      bindingMode: "claimed_agent",
      label: "claimed-agent"
    });

    expect(wallet.id).toMatch(/^wallet_internal_/);
    expect(wallet.agentId).toBe("agent_1");
    expect(wallet.bindingMode).toBe("claimed_agent");
    expect(wallet.label).toBe("claimed-agent");
    expect(wallet.address).toMatch(/^0x/);
    expect(wallet).not.toHaveProperty("privateKey");
    expect(wallet).not.toHaveProperty("encryptedPrivateKey");
  });

  it("returns a defensive wallet copy without key material", async () => {
    const store = createMemoryWalletStore({ walletSecret: "secret", quoteAssetType });
    const wallet = await store.createWallet({
      agentId: "agent_internal_001",
      bindingMode: "internal_probe"
    });

    const fetched = await store.getWallet(wallet.id);
    expect(fetched).toEqual(wallet);
    expect(fetched).not.toBe(wallet);
    expect(fetched).not.toHaveProperty("privateKey");
    expect(fetched).not.toHaveProperty("encryptedPrivateKey");

    fetched!.label = "mutated";
    await expect(store.getWallet(wallet.id)).resolves.toMatchObject({
      label: undefined
    });
  });

  it("restores an internal signer for the wallet without exposing key material", async () => {
    const store = createMemoryWalletStore({ walletSecret: "secret", quoteAssetType });
    const wallet = await store.createWallet({
      agentId: "agent_internal_001",
      bindingMode: "internal_probe"
    });

    const signer = await store.getSigner(wallet.id);

    expect(signer.toSuiAddress()).toBe(wallet.address);
    expect(JSON.stringify(await store.getWallet(wallet.id))).not.toContain("secretKey");
    expect(JSON.stringify(await store.getWallet(wallet.id))).not.toContain("encryptedPrivateKey");
  });

  it("lists defensive wallet copies without key material", async () => {
    const store = createMemoryWalletStore({ walletSecret: "secret", quoteAssetType });
    const first = await store.createWallet({
      agentId: "agent_internal_001",
      bindingMode: "internal_probe"
    });
    await store.createWallet({
      agentId: "agent_internal_002",
      bindingMode: "internal_probe",
      label: "second"
    });

    const wallets = await store.listWallets();
    expect(wallets).toHaveLength(2);
    for (const wallet of wallets) {
      expect(wallet).not.toHaveProperty("privateKey");
      expect(wallet).not.toHaveProperty("encryptedPrivateKey");
    }

    wallets[0]!.label = "mutated";
    await expect(store.getWallet(first.id)).resolves.toMatchObject({
      label: undefined
    });
  });

  it("rejects blank wallet secrets", () => {
    expect(() => createMemoryWalletStore({ walletSecret: "   ", quoteAssetType }))
      .toThrow("MISSING_WALLET_SECRET");
  });

  it("reads SUI and DUSDC raw balances with an injected balance reader", async () => {
    const calls: Array<{ method: string; address: string; coinType?: string }> = [];
    const balanceReader: CoinBalanceReader = {
      async getSuiBalance(address) {
        calls.push({ method: "getSuiBalance", address });
        return "123456789";
      },
      async getCoinBalance(address, coinType) {
        calls.push({ method: "getCoinBalance", address, coinType });
        return "42000000";
      }
    };
    const store = createMemoryWalletStore({
      walletSecret: "secret",
      balanceReader,
      quoteAssetType
    });
    const wallet = await store.createWallet({
      agentId: "agent_internal_001",
      bindingMode: "internal_probe"
    });

    const balances = await store.getBalances(wallet.id);

    expect(balances).toEqual({
      walletId: wallet.id,
      address: wallet.address,
      suiBalanceRaw: "123456789",
      quoteAssetType,
      dusdcBalanceRaw: "42000000"
    });
    expect(calls).toEqual([
      { method: "getSuiBalance", address: wallet.address },
      { method: "getCoinBalance", address: wallet.address, coinType: quoteAssetType }
    ]);
  });

  it("rejects balance reads for unknown wallets", async () => {
    const balanceReader: CoinBalanceReader = {
      async getSuiBalance() {
        return "123456789";
      },
      async getCoinBalance() {
        return "42000000";
      }
    };
    const store = createMemoryWalletStore({
      walletSecret: "secret",
      balanceReader,
      quoteAssetType
    });

    await expect(store.getBalances("wallet_missing")).rejects.toThrow("WALLET_NOT_FOUND");
  });

  it("rejects balance reads when no balance reader is configured", async () => {
    const store = createMemoryWalletStore({ walletSecret: "secret", quoteAssetType });
    const wallet = await store.createWallet({
      agentId: "agent_internal_001",
      bindingMode: "internal_probe"
    });

    await expect(store.getBalances(wallet.id)).rejects.toThrow("BALANCE_READER_NOT_CONFIGURED");
  });

  it("persists wallets to JSON without returning private key material", async () => {
    const storePath = await makeTempStorePath("wallets");
    const firstStore = createJsonWalletStore({
      walletSecret: "secret",
      quoteAssetType,
      storePath
    });
    const wallet = await firstStore.createWallet({
      agentId: "agent_internal_001",
      bindingMode: "internal_probe",
      label: "json-persisted"
    });

    const secondStore = createJsonWalletStore({
      walletSecret: "secret",
      quoteAssetType,
      storePath
    });

    await expect(secondStore.getWallet(wallet.id)).resolves.toEqual(wallet);
    await expect(secondStore.listWallets()).resolves.toEqual([wallet]);
    await expect(secondStore.getSigner(wallet.id)).resolves.toMatchObject({
      toSuiAddress: expect.any(Function)
    });
    expect((await secondStore.getSigner(wallet.id)).toSuiAddress()).toBe(wallet.address);
    expect(JSON.stringify(await secondStore.getWallet(wallet.id))).not.toContain("encryptedPrivateKey");
    expect(JSON.stringify(await secondStore.listWallets())).not.toContain("encryptedPrivateKey");
  });

  it("persists wallets and encrypted private keys to SQLite without exposing private material", async () => {
    const dbPath = await makeTempStorePath("wallets-sqlite");
    const firstStore = createSqliteWalletStore({
      walletSecret: "secret",
      quoteAssetType,
      dbPath
    });
    const wallet = await firstStore.createWallet({
      agentId: "agent_1",
      bindingMode: "claimed_agent",
      label: "sqlite-persisted"
    });

    const secondStore = createSqliteWalletStore({
      walletSecret: "secret",
      quoteAssetType,
      dbPath
    });

    await expect(secondStore.getWallet(wallet.id)).resolves.toEqual(wallet);
    expect((await secondStore.getSigner(wallet.id)).toSuiAddress()).toBe(wallet.address);
    expect(JSON.stringify(await secondStore.getWallet(wallet.id))).not.toContain("encryptedPrivateKey");
    expect(JSON.stringify(await secondStore.listWallets())).not.toContain("encryptedPrivateKey");
  });

  it("rejects signer restoration with the wrong wallet secret", async () => {
    const storePath = await makeTempStorePath("wallets-secret-mismatch");
    const firstStore = createJsonWalletStore({
      walletSecret: "correct-secret",
      quoteAssetType,
      storePath
    });
    const wallet = await firstStore.createWallet({
      agentId: "agent_internal_001",
      bindingMode: "internal_probe"
    });
    const secondStore = createJsonWalletStore({
      walletSecret: "wrong-secret",
      quoteAssetType,
      storePath
    });

    await expect(secondStore.getSigner(wallet.id)).rejects.toThrow("WALLET_SECRET_MISMATCH");
  });
});

async function makeTempStorePath(prefix: string): Promise<string> {
  const root = join(tmpdir(), "agent-arena-backend-tests", `${prefix}-${crypto.randomUUID()}`);
  await mkdir(root, { recursive: true });
  return join(root, "store.json");
}
