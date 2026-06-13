import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQLiteAttributionStore } from "./sqlite-attribution-store";
import type { CreateAttributionInput } from "./attribution";

const tempDirs: string[] = [];

const baseInput: CreateAttributionInput = {
  userAddress: "0xuser",
  managerId: "0xmanager",
  roundId: "round-btc-15m",
  agentId: "volatility-sniper",
  oracleId: "0xoracle",
  digest: "0xdigest",
  predictPositionType: "directional",
  marketKey: "BTC_UP_60000",
  rangeKey: null,
  amount: 100,
  strategySnapshot: "Breakout after spread compression"
};

function createTempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "agent-arena-sqlite-"));
  tempDirs.push(dir);
  return join(dir, "agent-arena.sqlite");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();

    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("SQLiteAttributionStore", () => {
  it("persists attribution records across store instances", () => {
    const dbPath = createTempDbPath();
    const firstStore = new SQLiteAttributionStore(dbPath);

    firstStore.create(baseInput, "2026-06-10T00:00:00.000Z");
    firstStore.close();

    const secondStore = new SQLiteAttributionStore(dbPath);
    const records = secondStore.listByUser("0xUSER");

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      userAddress: "0xuser",
      digest: "0xdigest",
      agentId: "volatility-sniper",
      status: "submitted",
      createdAt: "2026-06-10T00:00:00.000Z"
    });

    secondStore.close();
  });

  it("creates the database directory when it does not exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "agent-arena-sqlite-parent-"));
    tempDirs.push(dir);
    const dbPath = join(dir, "nested", "agent-arena.sqlite");
    const store = new SQLiteAttributionStore(dbPath);

    expect(existsSync(dbPath)).toBe(true);

    store.close();
  });

  it("rejects duplicate digest and agent records using SQLite constraints", () => {
    const store = new SQLiteAttributionStore(createTempDbPath());

    store.create(baseInput);

    expect(() => store.create(baseInput)).toThrow(/already exists/i);

    store.close();
  });
});
