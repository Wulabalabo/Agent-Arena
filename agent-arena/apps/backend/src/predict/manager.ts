export type PredictManagerSource = "local" | "server" | "event";

export type PredictManagerErrorCode =
  | "MISSING_WALLET_ADDRESS"
  | "MANAGER_OWNER_MISMATCH"
  | "INVALID_DEPOSIT_DUSDC_RAW";

export class PredictManagerError extends Error {
  readonly code: PredictManagerErrorCode;

  constructor(code: PredictManagerErrorCode, message = code) {
    super(message);
    this.name = "PredictManagerError";
    this.code = code;
  }
}

export interface InternalPredictManagerBinding {
  id: string;
  walletId: string;
  agentId: string;
  address: string;
  managerId: string;
  createdAt: string;
  status: "missing" | "creating" | "ready" | "failed";
  lastCheckedAt: string;
}

export interface DiscoveredPredictManager {
  managerId: string;
  ownerAddress: string;
  address: string;
  source: PredictManagerSource;
  binding?: InternalPredictManagerBinding;
}

export interface DiscoverPredictManagerInput {
  walletAddress: string;
  localBinding?: InternalPredictManagerBinding | null;
  listServerManagers?: () => Promise<unknown>;
  listEventCandidates?: () => Promise<unknown>;
  verifyManagerOwner: (managerId: string, walletAddress: string) => Promise<boolean>;
}

export type CreateManagerPlan = "skip" | "dry_run_only" | "submit_required";
export type DepositSetupStatus =
  | "not_requested"
  | "blocked_until_manager_exists"
  | "ready_to_dry_run";

export interface ManagerSetupPlan {
  createManager: CreateManagerPlan;
  depositStatus: DepositSetupStatus;
  managerId?: string;
  depositDusdcRaw?: string;
}

export interface PlanManagerSetupInput {
  manager?: DiscoveredPredictManager | null;
  dryRunOnly: boolean;
  depositDusdcRaw?: string | null;
}

export async function discoverPredictManager(
  input: DiscoverPredictManagerInput
): Promise<DiscoveredPredictManager | null> {
  const walletAddress = input.walletAddress.trim();
  if (!walletAddress) {
    throw new PredictManagerError("MISSING_WALLET_ADDRESS");
  }

  if (input.localBinding) {
    return verifyCandidate(input, {
      managerId: input.localBinding.managerId,
      ownerAddress: walletAddress,
      address: walletAddress,
      source: "local",
      binding: { ...input.localBinding }
    });
  }

  const serverCandidate = input.listServerManagers
    ? findWalletCandidate(await input.listServerManagers(), walletAddress, "server")
    : null;
  if (serverCandidate) {
    return verifyCandidate(input, serverCandidate);
  }

  const eventCandidate = input.listEventCandidates
    ? findWalletCandidate(await input.listEventCandidates(), walletAddress, "event")
    : null;
  if (eventCandidate) {
    return verifyCandidate(input, eventCandidate);
  }

  return null;
}

export function planManagerSetup(input: PlanManagerSetupInput): ManagerSetupPlan {
  const depositDusdcRaw = normalizeOptionalRawAmount(input.depositDusdcRaw);

  if (!input.manager) {
    const plan: ManagerSetupPlan = {
      createManager: input.dryRunOnly ? "dry_run_only" : "submit_required",
      depositStatus: "blocked_until_manager_exists"
    };

    if (depositDusdcRaw !== null && BigInt(depositDusdcRaw) > 0n) {
      return {
        ...plan,
        depositDusdcRaw
      };
    }

    return plan;
  }

  if (depositDusdcRaw !== null && BigInt(depositDusdcRaw) > 0n) {
    return {
      createManager: "skip",
      depositStatus: "ready_to_dry_run",
      managerId: input.manager.managerId,
      depositDusdcRaw
    };
  }

  return {
    createManager: "skip",
    depositStatus: "not_requested",
    managerId: input.manager.managerId
  };
}

async function verifyCandidate(
  input: DiscoverPredictManagerInput,
  candidate: DiscoveredPredictManager
): Promise<DiscoveredPredictManager> {
  const verified = await input.verifyManagerOwner(
    candidate.managerId,
    input.walletAddress.trim()
  );
  if (!verified) {
    throw new PredictManagerError("MANAGER_OWNER_MISMATCH");
  }

  return candidate;
}

function findWalletCandidate(
  rawCandidates: unknown,
  walletAddress: string,
  source: PredictManagerSource
): DiscoveredPredictManager | null {
  for (const rawCandidate of candidateItems(rawCandidates)) {
    const candidate = normalizeCandidate(rawCandidate, source);
    if (candidate && sameSuiAddress(candidate.ownerAddress, walletAddress)) {
      return candidate;
    }
  }

  return null;
}

function normalizeCandidate(
  rawCandidate: unknown,
  source: PredictManagerSource
): DiscoveredPredictManager | null {
  const candidateRecords = extractCandidateRecords(rawCandidate);
  if (candidateRecords.length === 0) {
    return null;
  }

  for (const record of candidateRecords) {
    const managerId = firstObjectId(
      record.managerId,
      record.manager_id,
      record.objectId,
      record.id
    );
    const ownerAddress = firstString(
      record.ownerAddress,
      record.owner_address,
      record.owner,
      record.address
    );

    if (managerId && ownerAddress) {
      return {
        managerId,
        ownerAddress,
        address: ownerAddress,
        source
      };
    }
  }

  return null;
}

function normalizeOptionalRawAmount(rawAmount: string | null | undefined): string | null {
  if (rawAmount === null || rawAmount === undefined) {
    return null;
  }

  const normalized = rawAmount.trim();
  if (normalized === "") {
    return null;
  }

  if (!/^\d+$/.test(normalized)) {
    throw new PredictManagerError("INVALID_DEPOSIT_DUSDC_RAW");
  }

  return normalized;
}

function candidateItems(rawCandidates: unknown): unknown[] {
  if (Array.isArray(rawCandidates)) {
    return rawCandidates;
  }

  if (!isRecord(rawCandidates)) {
    return [];
  }

  const containerItems = [
    ...arrayValue(rawCandidates.managers),
    ...arrayValue(rawCandidates.data),
    ...arrayValue(rawCandidates.events)
  ];

  return containerItems.length > 0 ? containerItems : [rawCandidates];
}

function extractCandidateRecords(rawCandidate: unknown): Record<string, unknown>[] {
  if (!isRecord(rawCandidate)) {
    return [];
  }

  const dataRecord = recordAt(rawCandidate, ["data"]);
  const dataFields = recordAt(rawCandidate, ["data", "content", "fields"]);
  const contentFields = recordAt(rawCandidate, ["content", "fields"]);

  return [
    recordValue(rawCandidate.parsedJson),
    recordValue(rawCandidate.parsed_json),
    combineObjectIdWithFields(dataRecord, dataFields),
    combineObjectIdWithFields(rawCandidate, contentFields),
    dataFields,
    contentFields,
    rawCandidate,
    dataRecord
  ].filter((record): record is Record<string, unknown> => record !== null);
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function recordAt(
  record: Record<string, unknown>,
  path: string[]
): Record<string, unknown> | null {
  let current: unknown = record;
  for (const key of path) {
    if (!isRecord(current)) {
      return null;
    }
    current = current[key];
  }

  return recordValue(current);
}

function combineObjectIdWithFields(
  objectRecord: Record<string, unknown> | null,
  fields: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!fields) {
    return null;
  }

  const objectId = objectRecord ? firstObjectId(objectRecord.objectId) : null;
  return objectId ? { ...fields, objectId } : fields;
}

function sameSuiAddress(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function firstObjectId(...values: unknown[]): string | null {
  for (const value of values) {
    const objectId = objectIdString(value);
    if (objectId) {
      return objectId;
    }
  }

  return null;
}

function objectIdString(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }

  if (isRecord(value) && typeof value.id === "string" && value.id.trim() !== "") {
    return value.id.trim();
  }

  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
