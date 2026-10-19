/**
 * HoodStreet Passport — formatters
 *
 * All numbers in MCP responses are raw bigint strings (no decimals applied).
 * Convert to human-readable using the asset's decimals.
 */

const ETH = 18;

export function formatRaw(raw: string, decimals: number, maxFractionDigits = 6): string {
  if (!raw || raw === '0') return '0';
  const n = BigInt(raw);
  if (decimals === 0) return n.toString();
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  const frac = n % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, maxFractionDigits).replace(/0+$/, '');
  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
}

export function formatEth(raw: string): string {
  const v = formatRaw(raw, ETH, 6);
  return `${v} ETH`;
}

export function formatToken(raw: string, symbol: string, decimals = 18): string {
  return `${formatRaw(raw, decimals, 4)} ${symbol}`;
}

export function shortenAddress(addr: string, head = 6, tail = 4): string {
  if (!addr || addr.length < head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function formatTimestamp(ms: number | undefined | null): string {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

export function explorerUrl(kind: 'address' | 'tx' | 'token', value: string): string {
  const base = 'https://robinhoodchain.blockscout.com';
  if (kind === 'tx') return `${base}/tx/${value}`;
  if (kind === 'token') return `${base}/tokens/${value}`;
  return `${base}/address/${value}`;
}

export function hoodstreetNeonUrl(parentAddress: string): string {
  return `https://hoodstreet.capital/myneon?wallet=${parentAddress}`;
}
