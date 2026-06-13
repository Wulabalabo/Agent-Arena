import { Database } from "bun:sqlite";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import {
  createAttributionRecord,
  normalizeAddress,
  AttributionInputError,
  type AttributionRecord,
  type AttributionStatus,
  type AttributionStoreLike,
  type CreateAttributionInput,
  type PredictPositionType
} from "./attribution";

interface AttributionRow {
  id: string;
  user_address: string;
  manager_id: string;
  round_id: string;
  agent_id: string;
  oracle_id: string;
  digest: string;
  predict_position_type: PredictPositionType;
  market_key: string | null;
  range_key: string | null;
  amount: number;
  strategy_snapshot: string;
  status: AttributionStatus;
  created_at: string;
  updated_at: string;
}

export class SQLiteAttributionStore implements AttributionStoreLike {
  private readonly db: Database;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") {
      mkdirSync(dirname(dbPath), { recursive: true });
    }

    this.db = new Database(dbPath, { create: true });
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  create(input: CreateAttributionInput, now = new Date().toISOString()): AttributionRecord {
    const record = createAttributionRecord(input, now);

    try {
      this.db
        .query(
          `
          INSERT INTO attributions (
            id,
            user_address,
            normalized_user_address,
            manager_id,
            round_id,
            agent_id,
            oracle_id,
            digest,
            predict_position_type,
            market_key,
            range_key,
            amount,
            strategy_snapshot,
            status,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        )
        .run(
          record.id,
          record.userAddress,
          normalizeAddress(record.userAddress),
          record.managerId,
          record.roundId,
          record.agentId,
          record.oracleId,
          record.digest,
          record.predictPositionType,
          record.marketKey,
          record.rangeKey,
          record.amount,
          record.strategySnapshot,
          record.status,
          record.createdAt,
          record.updatedAt
        );
    } catch (error) {
      if (isSqliteConstraintError(error)) {
        throw new AttributionInputError(`Attribution already exists for ${input.digest} and ${input.agentId}`);
      }

      throw error;
    }

    return record;
  }

  listByUser(userAddress: string): AttributionRecord[] {
    const rows = this.db
      .query("SELECT * FROM attributions WHERE normalized_user_address = ? ORDER BY created_at DESC")
      .all(normalizeAddress(userAddress)) as AttributionRow[];

    return rows.map(mapAttributionRow);
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS attributions (
        id TEXT PRIMARY KEY,
        user_address TEXT NOT NULL,
        normalized_user_address TEXT NOT NULL,
        manager_id TEXT NOT NULL,
        round_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        oracle_id TEXT NOT NULL,
        digest TEXT NOT NULL,
        predict_position_type TEXT NOT NULL CHECK (predict_position_type IN ('directional', 'range')),
        market_key TEXT,
        range_key TEXT,
        amount REAL NOT NULL CHECK (amount > 0),
        strategy_snapshot TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('submitted', 'confirmed', 'redeemable', 'redeemed', 'failed')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (digest, agent_id)
      )
    `);

    this.db.run("CREATE INDEX IF NOT EXISTS idx_attributions_user ON attributions (normalized_user_address)");
    this.db.run("CREATE INDEX IF NOT EXISTS idx_attributions_round ON attributions (round_id)");
  }
}

function mapAttributionRow(row: AttributionRow): AttributionRecord {
  return {
    id: row.id,
    userAddress: row.user_address,
    managerId: row.manager_id,
    roundId: row.round_id,
    agentId: row.agent_id,
    oracleId: row.oracle_id,
    digest: row.digest,
    predictPositionType: row.predict_position_type,
    marketKey: row.market_key,
    rangeKey: row.range_key,
    amount: row.amount,
    strategySnapshot: row.strategy_snapshot,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isSqliteConstraintError(error: unknown): boolean {
  return error instanceof Error && /constraint/i.test(error.message);
}
