import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  CoinBalanceReader,
  InternalTradingWallet,
  InternalWalletBalances,
  InternalWalletBindingMode
} from "./types";

interface CreateMemoryWalletStoreOptions {
  walletSecret: string;
  balanceReader?: CoinBalanceReader;
  quoteAssetType?: string;
}

interface CreateJsonWalletStoreOptions extends CreateMemoryWalletStoreOptions {
  storePath: string;
}

interface CreateSqliteWalletStoreOptions extends CreateMemoryWalletStoreOptions {
  dbPath: string;
}

interface CreateWalletInput {
  agentId: string;
  bindingMode: InternalWalletBindingMode;
  label?: string;
}

interface InternalWalletRecord {
  wallet: InternalTradingWallet;
  encryptedPrivateKey: string;
}

export interface MemoryWalletStore {
  createWallet(input: CreateWalletInput): Promise<InternalTradingWallet>;
  getWallet(walletId: string): Promise<InternalTradingWallet | null>;
  listWallets(): Promise<InternalTradingWallet[]>;
  getBalances(walletId: string): Promise<InternalWalletBalances>;
  getSigner(walletId: string): Promise<Ed25519Keypair>;
}

interface JsonWalletStoreFile {
  version: 1;
  nextWalletNumber: number;
  records: InternalWalletRecord[];
}

const defaultQuoteAssetType = "0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC";

export function createMemoryWalletStore(options: CreateMemoryWalletStoreOptions): MemoryWalletStore {
  const walletSecret = options.walletSecret.trim();
  if (!walletSecret) {
    throw new Error("MISSING_WALLET_SECRET");
  }

  const records = new Map<string, InternalWalletRecord>();
  const quoteAssetType = options.quoteAssetType ?? defaultQuoteAssetType;
  let nextWalletNumber = 1;

  return {
    async createWallet(input) {
      const keypair = new Ed25519Keypair();
      const walletId = `wallet_internal_${String(nextWalletNumber).padStart(3, "0")}`;
      nextWalletNumber += 1;

      const wallet: InternalTradingWallet = {
        id: walletId,
        agentId: input.agentId,
        bindingMode: input.bindingMode,
        label: input.label,
        address: keypair.getPublicKey().toSuiAddress(),
        publicKey: keypair.getPublicKey().toBase64(),
        keyScheme: "ed25519",
        status: "active",
        testnetOnly: true,
        createdAt: new Date().toISOString()
      };

      records.set(walletId, {
        wallet,
        encryptedPrivateKey: sealPrivateKey(keypair.getSecretKey(), walletSecret)
      });

      return copyWallet(wallet);
    },

    async getWallet(walletId) {
      const record = records.get(walletId);
      return record ? copyWallet(record.wallet) : null;
    },

    async listWallets() {
      return Array.from(records.values(), (record) => copyWallet(record.wallet));
    },

    async getBalances(walletId) {
      const record = records.get(walletId);
      if (!record) {
        throw new Error("WALLET_NOT_FOUND");
      }
      if (!options.balanceReader) {
        throw new Error("BALANCE_READER_NOT_CONFIGURED");
      }

      const address = record.wallet.address;
      const [suiBalanceRaw, dusdcBalanceRaw] = await Promise.all([
        options.balanceReader.getSuiBalance(address),
        options.balanceReader.getCoinBalance(address, quoteAssetType)
      ]);

      return {
        walletId,
        address,
        suiBalanceRaw,
        quoteAssetType,
        dusdcBalanceRaw
      };
    },

    async getSigner(walletId) {
      const record = records.get(walletId);
      if (!record) {
        throw new Error("WALLET_NOT_FOUND");
      }

      return restoreSigner(record, walletSecret);
    }
  };
}

export function createJsonWalletStore(options: CreateJsonWalletStoreOptions): MemoryWalletStore {
  const walletSecret = options.walletSecret.trim();
  if (!walletSecret) {
    throw new Error("MISSING_WALLET_SECRET");
  }
  if (!options.storePath.trim()) {
    throw new Error("MISSING_WALLET_STORE_PATH");
  }

  const quoteAssetType = options.quoteAssetType ?? defaultQuoteAssetType;

  return {
    async createWallet(input) {
      const file = await loadWalletFile(options.storePath);
      const keypair = new Ed25519Keypair();
      const walletId = `wallet_internal_${String(file.nextWalletNumber).padStart(3, "0")}`;
      file.nextWalletNumber += 1;

      const wallet: InternalTradingWallet = {
        id: walletId,
        agentId: input.agentId,
        bindingMode: input.bindingMode,
        label: input.label,
        address: keypair.getPublicKey().toSuiAddress(),
        publicKey: keypair.getPublicKey().toBase64(),
        keyScheme: "ed25519",
        status: "active",
        testnetOnly: true,
        createdAt: new Date().toISOString()
      };

      file.records.push({
        wallet,
        encryptedPrivateKey: sealPrivateKey(keypair.getSecretKey(), walletSecret)
      });
      await saveWalletFile(options.storePath, file);

      return copyWallet(wallet);
    },

    async getWallet(walletId) {
      const file = await loadWalletFile(options.storePath);
      const record = file.records.find((candidate) => candidate.wallet.id === walletId);
      return record ? copyWallet(record.wallet) : null;
    },

    async listWallets() {
      const file = await loadWalletFile(options.storePath);
      return file.records.map((record) => copyWallet(record.wallet));
    },

    async getBalances(walletId) {
      const file = await loadWalletFile(options.storePath);
      const record = file.records.find((candidate) => candidate.wallet.id === walletId);
      if (!record) {
        throw new Error("WALLET_NOT_FOUND");
      }
      if (!options.balanceReader) {
        throw new Error("BALANCE_READER_NOT_CONFIGURED");
      }

      const address = record.wallet.address;
      const [suiBalanceRaw, dusdcBalanceRaw] = await Promise.all([
        options.balanceReader.getSuiBalance(address),
        options.balanceReader.getCoinBalance(address, quoteAssetType)
      ]);

      return {
        walletId,
        address,
        suiBalanceRaw,
        quoteAssetType,
        dusdcBalanceRaw
      };
    },

    async getSigner(walletId) {
      const file = await loadWalletFile(options.storePath);
      const record = file.records.find((candidate) => candidate.wallet.id === walletId);
      if (!record) {
        throw new Error("WALLET_NOT_FOUND");
      }

      return restoreSigner(record, walletSecret);
    }
  };
}

export function createSqliteWalletStore(options: CreateSqliteWalletStoreOptions): MemoryWalletStore {
  const walletSecret = options.walletSecret.trim();
  if (!walletSecret) {
    throw new Error("MISSING_WALLET_SECRET");
  }
  if (!options.dbPath.trim()) {
    throw new Error("MISSING_WALLET_STORE_PATH");
  }

  const quoteAssetType = options.quoteAssetType ?? defaultQuoteAssetType;
  mkdirSync(dirname(options.dbPath), { recursive: true });
  const db = new Database(options.dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS internal_wallets (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      binding_mode TEXT NOT NULL,
      label TEXT,
      address TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      key_scheme TEXT NOT NULL,
      status TEXT NOT NULL,
      testnet_only INTEGER NOT NULL,
      quote_asset_type TEXT NOT NULL,
      encrypted_private_key TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS internal_wallet_store_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  return {
    async createWallet(input) {
      const nextWalletNumber = readNextSqliteWalletNumber(db);
      const keypair = new Ed25519Keypair();
      const walletId = `wallet_internal_${String(nextWalletNumber).padStart(3, "0")}`;
      const wallet: InternalTradingWallet = {
        id: walletId,
        agentId: input.agentId,
        bindingMode: input.bindingMode,
        label: input.label,
        address: keypair.getPublicKey().toSuiAddress(),
        publicKey: keypair.getPublicKey().toBase64(),
        keyScheme: "ed25519",
        status: "active",
        testnetOnly: true,
        createdAt: new Date().toISOString()
      };

      db.query(`
        INSERT INTO internal_wallets (
          id,
          agent_id,
          binding_mode,
          label,
          address,
          public_key,
          key_scheme,
          status,
          testnet_only,
          quote_asset_type,
          encrypted_private_key,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        wallet.id,
        wallet.agentId,
        wallet.bindingMode,
        wallet.label ?? null,
        wallet.address,
        wallet.publicKey,
        wallet.keyScheme,
        wallet.status,
        wallet.testnetOnly ? 1 : 0,
        quoteAssetType,
        sealPrivateKey(keypair.getSecretKey(), walletSecret),
        wallet.createdAt
      );
      writeNextSqliteWalletNumber(db, nextWalletNumber + 1);

      return copyWallet(wallet);
    },

    async getWallet(walletId) {
      const record = readSqliteWalletRecord(db, walletId);
      return record ? copyWallet(record.wallet) : null;
    },

    async listWallets() {
      return db.query("SELECT * FROM internal_wallets ORDER BY id")
        .all()
        .map((row) => copyWallet(sqliteRowToWalletRecord(row).wallet));
    },

    async getBalances(walletId) {
      const record = readSqliteWalletRecord(db, walletId);
      if (!record) {
        throw new Error("WALLET_NOT_FOUND");
      }
      if (!options.balanceReader) {
        throw new Error("BALANCE_READER_NOT_CONFIGURED");
      }

      const address = record.wallet.address;
      const [suiBalanceRaw, dusdcBalanceRaw] = await Promise.all([
        options.balanceReader.getSuiBalance(address),
        options.balanceReader.getCoinBalance(address, quoteAssetType)
      ]);

      return {
        walletId,
        address,
        suiBalanceRaw,
        quoteAssetType,
        dusdcBalanceRaw
      };
    },

    async getSigner(walletId) {
      const record = readSqliteWalletRecord(db, walletId);
      if (!record) {
        throw new Error("WALLET_NOT_FOUND");
      }

      return restoreSigner(record, walletSecret);
    }
  };
}

function copyWallet(wallet: InternalTradingWallet): InternalTradingWallet {
  return { ...wallet };
}

function sealPrivateKey(privateKey: string, walletSecret: string): string {
  return Buffer.from(`${walletSecret}:${privateKey}`, "utf8").toString("base64");
}

function restoreSigner(record: InternalWalletRecord, walletSecret: string): Ed25519Keypair {
  const privateKey = unsealPrivateKey(record.encryptedPrivateKey, walletSecret);
  const signer = Ed25519Keypair.fromSecretKey(privateKey);
  if (signer.toSuiAddress().toLowerCase() !== record.wallet.address.toLowerCase()) {
    throw new Error("WALLET_SIGNER_ADDRESS_MISMATCH");
  }

  return signer;
}

function unsealPrivateKey(encryptedPrivateKey: string, walletSecret: string): string {
  let decoded: string;
  try {
    decoded = Buffer.from(encryptedPrivateKey, "base64").toString("utf8");
  } catch {
    throw new Error("INVALID_WALLET_PRIVATE_KEY");
  }

  const prefix = `${walletSecret}:`;
  if (!decoded.startsWith(prefix)) {
    throw new Error("WALLET_SECRET_MISMATCH");
  }

  const privateKey = decoded.slice(prefix.length);
  if (!privateKey) {
    throw new Error("INVALID_WALLET_PRIVATE_KEY");
  }

  return privateKey;
}

async function loadWalletFile(storePath: string): Promise<JsonWalletStoreFile> {
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<JsonWalletStoreFile>;
    if (parsed.version !== 1 || !Array.isArray(parsed.records)) {
      throw new Error("INVALID_WALLET_STORE_FILE");
    }

    return {
      version: 1,
      nextWalletNumber: normalizeNextWalletNumber(parsed),
      records: parsed.records.map(normalizeWalletRecord)
    };
  } catch (error) {
    if (isMissingFile(error)) {
      return {
        version: 1,
        nextWalletNumber: 1,
        records: []
      };
    }
    throw error;
  }
}

async function saveWalletFile(storePath: string, file: JsonWalletStoreFile): Promise<void> {
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

function normalizeNextWalletNumber(file: Partial<JsonWalletStoreFile>): number {
  if (Number.isSafeInteger(file.nextWalletNumber) && file.nextWalletNumber! > 0) {
    return file.nextWalletNumber!;
  }

  return file.records!.reduce((max, record) => {
    const match = record.wallet.id.match(/^wallet_internal_(\d+)$/);
    return match ? Math.max(max, Number(match[1]) + 1) : max;
  }, 1);
}

function normalizeWalletRecord(record: InternalWalletRecord): InternalWalletRecord {
  if (!record.wallet?.id || !record.wallet.address || !record.encryptedPrivateKey) {
    throw new Error("INVALID_WALLET_STORE_FILE");
  }

  return {
    wallet: copyWallet(record.wallet),
    encryptedPrivateKey: record.encryptedPrivateKey
  };
}

function readNextSqliteWalletNumber(db: Database): number {
  const row = db.query("SELECT value FROM internal_wallet_store_meta WHERE key = 'next_wallet_number'")
    .get() as { value: string } | null;
  if (row && /^\d+$/.test(row.value)) {
    return Number(row.value);
  }

  const ids = db.query("SELECT id FROM internal_wallets").all() as Array<{ id: string }>;
  return ids.reduce((next, row) => {
    const match = row.id.match(/^wallet_internal_(\d+)$/);
    return match ? Math.max(next, Number(match[1]) + 1) : next;
  }, 1);
}

function writeNextSqliteWalletNumber(db: Database, nextWalletNumber: number): void {
  db.query(`
    INSERT INTO internal_wallet_store_meta (key, value)
    VALUES ('next_wallet_number', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(nextWalletNumber));
}

function readSqliteWalletRecord(db: Database, walletId: string): InternalWalletRecord | null {
  const row = db.query("SELECT * FROM internal_wallets WHERE id = ?").get(walletId);
  return row ? sqliteRowToWalletRecord(row) : null;
}

function sqliteRowToWalletRecord(row: unknown): InternalWalletRecord {
  const record = row as Record<string, unknown>;
  return {
    wallet: {
      id: String(record.id),
      agentId: String(record.agent_id),
      bindingMode: String(record.binding_mode) as InternalWalletBindingMode,
      label: typeof record.label === "string" ? record.label : undefined,
      address: String(record.address),
      publicKey: String(record.public_key),
      keyScheme: String(record.key_scheme) as "ed25519",
      status: String(record.status) as InternalTradingWallet["status"],
      testnetOnly: true,
      createdAt: String(record.created_at)
    },
    encryptedPrivateKey: String(record.encrypted_private_key)
  };
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
