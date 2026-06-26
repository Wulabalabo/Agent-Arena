export const minimumQuoteBalanceRaw = 10_000_000n;

const mistPerSui = 1_000_000_000n;
const defaultMinimumTestnetSuiBalanceRaw = 1_000_000_000n;

export function parseRawBalance(value: string): bigint | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

export function parseMinimumTestnetSuiBalanceRaw(value: string | undefined): bigint {
  const parsed = value === undefined ? null : parseRawBalance(value);
  return parsed !== null && parsed >= 0n
    ? parsed
    : defaultMinimumTestnetSuiBalanceRaw;
}

export function parseTestnetSuiBalanceRaw(value: string): bigint | null {
  const trimmed = value.trim();
  const match = /^(\d+)(?:\.(\d{1,9}))?$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(9, "0"));
  return whole * mistPerSui + fraction;
}
