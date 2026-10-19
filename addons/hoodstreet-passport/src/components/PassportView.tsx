/**
 * HoodStreet Passport — Passport view
 *
 * Single-tokenId audit report. Three MCP calls, one canonical report.
 *
 * Reads the live addonAPI from window.addonAPI (with a 2s wait) so it picks
 * up the bridge even if it was injected after first mount.
 */

import { useEffect, useRef, useState } from 'react';
import type { AddonAPI } from '../types/addonApi';
import { callHoodstreetTool, resolveMcp, type McpMode } from '../lib/mcp';
import { explorerUrl, formatEth, formatToken, hoodstreetNeonUrl, shortenAddress } from '../lib/formatters';
import { writeJson } from '../lib/persistence';

interface Props {
  api: AddonAPI | undefined;
  initialTokenId?: string;
  bridgeReady: boolean;
}

const ASSETS_TO_DISPLAY = ['CCFF00', 'AAPL', 'AMZN', 'NVDA'];

interface PassportData {
  wallet: {
    tokenId: string;
    owner: string;
    canonicalTba: string;
    deployed: boolean;
    activationRequired: boolean;
    controller: string;
  };
  balances: {
    native: { symbol: string; raw: string; decimals: number };
    balances: Array<{ symbol: string; address: string; decimals: number; raw: string }>;
    tradingEnabled: boolean;
    locked: boolean;
  };
  activity: { items: unknown[]; hasMore: boolean };
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

export function PassportView({ api: apiProp, initialTokenId, bridgeReady }: Props) {
  const [tokenId, setTokenId] = useState(initialTokenId ?? '');
  const [status, setStatus] = useState<Status>('idle');
  const [data, setData] = useState<PassportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<McpMode>('demo');
  const [modeReason, setModeReason] = useState('enter a CCFF00 tokenId to start');
  const runIdRef = useRef(0);

  // Re-resolve the api on every call so we pick up the bridge once it mounts.
  function liveApi(): AddonAPI | undefined {
    return apiProp ?? (window.addonAPI as AddonAPI | undefined);
  }

  async function run(id: string) {
    if (!/^[1-9]\d*$/.test(id)) {
      setStatus('idle');
      setData(null);
      setModeReason('enter a CCFF00 tokenId to start');
      return;
    }
    setStatus('loading');
    setError(null);
    const myRun = ++runIdRef.current;
    const api = liveApi();
    try {
      const resolution = await resolveMcp(api);
      if (myRun !== runIdRef.current) return;
      setMode(resolution.mode);
      setModeReason(resolution.reason);
      const [walletRes, assetsRes, activityRes] = await Promise.all([
        callHoodstreetTool(api, resolution, 'get_neon_wallet', { tokenId: id, walletType: 'ccff00-erc6551' }),
        callHoodstreetTool(api, resolution, 'get_neon_assets', { tokenId: id, walletType: 'ccff00-erc6551' }),
        callHoodstreetTool(api, resolution, 'get_neon_activity', { tokenId: id, walletType: 'ccff00-erc6551' }),
      ]);
      if (myRun !== runIdRef.current) return;
      setData({
        wallet: parseWallet(walletRes, id),
        balances: parseAssets(assetsRes),
        activity: parseActivity(activityRes),
      });
      setStatus('ready');
    } catch (err) {
      if (myRun !== runIdRef.current) return;
      setError((err as Error).message);
      setStatus('error');
    }
  }

  // Run once when the bridge is ready (if a tokenId is already present).
  useEffect(() => {
    if (bridgeReady && tokenId) {
      void run(tokenId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeReady]);

  // Re-run whenever the user types a new tokenId.
  useEffect(() => {
    if (!tokenId) {
      setStatus('idle');
      setData(null);
      setModeReason('enter a CCFF00 tokenId to start');
      return;
    }
    void run(tokenId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenId]);

  async function exportReport() {
    if (!data) return;
    await writeJson(liveApi(), `passports/${tokenId}.json`, {
      generatedAt: new Date().toISOString(),
      tokenId,
      wallet: data.wallet,
      balances: data.balances,
      activity: data.activity,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[1-9][0-9]*"
          placeholder="CCFF00 tokenId (e.g. 7980)"
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value.replace(/[^0-9]/g, ''))}
          className="flex-1 px-3 py-2 rounded-md bg-mosaic-surface border border-mosaic-border text-mosaic-text placeholder:text-mosaic-muted focus:outline-none focus:border-mosaic-primary focus:ring-1 focus:ring-mosaic-primary font-mono text-sm"
        />
        <button
          type="button"
          onClick={() => run(tokenId)}
          disabled={status === 'loading' || !tokenId}
          className="px-4 py-2 rounded-md bg-mosaic-primary text-mosaic-bg font-semibold text-sm hover:bg-mosaic-primaryStrong disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'loading' ? 'Loading…' : 'Run audit'}
        </button>
        {status === 'ready' && (
          <button
            type="button"
            onClick={exportReport}
            className="px-3 py-2 rounded-md border border-mosaic-border text-mosaic-textMuted hover:border-mosaic-primary hover:text-mosaic-primary text-sm transition-colors"
          >
            Export
          </button>
        )}
      </div>

      <ModeBanner mode={mode} reason={modeReason} />

      {status === 'error' && (
        <div className="p-3 rounded-md border border-mosaic-danger/50 bg-mosaic-danger/10 text-mosaic-danger text-sm">
          {error ?? 'Audit failed'}
        </div>
      )}

      {status === 'ready' && data && (
        <div className="grid gap-3">
          <Card title={`Neon #${data.wallet.tokenId}`} accent>
            <Row label="Owner (parent EOA)" value={shortenAddress(data.wallet.owner)} link={explorerUrl('address', data.wallet.owner)} />
            <Row label="Canonical TBA" value={shortenAddress(data.wallet.canonicalTba)} link={explorerUrl('address', data.wallet.canonicalTba)} />
            <Row label="Controller" value={shortenAddress(data.wallet.controller)} />
            <Row label="Deployed" value={data.wallet.deployed ? 'Yes' : 'No'} />
            <Row label="Activation required" value={data.wallet.activationRequired ? 'Yes' : 'No'} />
            <div className="pt-3 flex gap-2 flex-wrap border-t border-mosaic-border mt-2">
              <ExternalLink href={hoodstreetNeonUrl(data.wallet.owner)} api={liveApi()} label="Open My Neon" />
              <ExternalLink href={explorerUrl('address', data.wallet.canonicalTba)} api={liveApi()} label="TBA on Blockscout" />
            </div>
          </Card>

          <Card title="Balances">
            <Row label="Native" value={formatEth(data.balances.native.raw)} />
            {ASSETS_TO_DISPLAY.map((sym) => {
              const b = data.balances.balances.find((x) => x.symbol === sym);
              return <Row key={sym} label={sym} value={b ? formatToken(b.raw, sym) : '—'} />;
            })}
          </Card>

          <Card title="Trading lock">
            <Row
              label="CCFF00 transfers"
              value={data.balances.locked ? 'Locked' : 'Enabled'}
              valueClass={data.balances.locked ? 'text-mosaic-warning' : 'text-mosaic-success'}
            />
            <p className="text-xs text-mosaic-muted pt-2 leading-relaxed">
              Transfers may be permanently activated after the public mint is complete
              (per the HoodStreet covenant). This addon never moves funds.
            </p>
          </Card>

          <Card title={`Recent activity (${data.activity.items.length} items)`}>
            {data.activity.items.length > 0 ? (
              <pre className="text-xs text-mosaic-textMuted overflow-auto max-h-40 font-mono">
                {JSON.stringify(data.activity.items.slice(0, 5), null, 2)}
              </pre>
            ) : (
              <p className="text-mosaic-muted text-sm">No recent transfers recorded.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function ModeBanner({ mode, reason }: { mode: McpMode; reason: string }) {
  const styles =
    mode === 'addon-bridge'
      ? 'bg-mosaic-success/10 border-mosaic-success/30 text-mosaic-success'
      : mode === 'not-configured'
      ? 'bg-mosaic-warning/10 border-mosaic-warning/30 text-mosaic-warning'
      : 'bg-mosaic-surface border-mosaic-border text-mosaic-textMuted';
  const label = mode === 'addon-bridge' ? 'addon-bridge' : mode === 'not-configured' ? 'not-configured' : 'demo';
  return (
    <div className={`text-xs px-3 py-2 rounded-md border ${styles}`}>
      <span className="font-semibold mr-1">MCP mode:</span>
      <span className="font-mono">{label}</span>
      <span className="mx-1.5 opacity-60">·</span>
      <span>{reason}</span>
    </div>
  );
}

function Card({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`p-4 rounded-lg border ${accent ? 'border-hoodstreet/40 bg-mosaic-surface' : 'border-mosaic-border bg-mosaic-surface'}`}>
      <h2 className={`text-sm font-semibold mb-3 ${accent ? 'text-hoodstreet' : 'text-mosaic-text'}`}>{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value, link, valueClass }: { label: string; value: string; link?: string; valueClass?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 text-sm">
      <span className="text-mosaic-textMuted">{label}</span>
      {link ? (
        <a
          href={link}
          onClick={(e) => e.preventDefault()}
          className="text-mosaic-primary hover:underline font-mono text-xs"
        >
          {value}
        </a>
      ) : (
        <span className={`font-mono text-xs ${valueClass ?? 'text-mosaic-text'}`}>{value}</span>
      )}
    </div>
  );
}

function ExternalLink({ href, label, api }: { href: string; label: string; api: AddonAPI | undefined }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (api?.ui?.openExternal) {
          void api.ui.openExternal(href);
        } else {
          window.open(href, '_blank', 'noopener');
        }
      }}
      className="text-xs px-3 py-1.5 rounded-md border border-mosaic-border text-mosaic-textMuted hover:border-mosaic-primary hover:text-mosaic-primary transition-colors"
    >
      {label} ↗
    </button>
  );
}

// --- response parsers --------------------------------------------------------

function textOf(r: { content?: Array<{ type: string; text: string }> } | undefined): string {
  if (!r || !r.content) return '';
  return r.content.map((c) => c.text).join('');
}

/**
 * Safely parse an MCP tool response that is expected to be a JSON
 * object. If the response is empty, non-JSON, or the wrong shape,
 * return a controlled error message rather than letting `JSON.parse`
 * throw a cryptic SyntaxError that the user sees as "Audit failed".
 */
function safeParseObject(
  raw: string,
  toolName: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { ok: false, error: `${toolName} returned an empty response.` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: `${toolName} returned non-JSON: ${trimmed.slice(0, 200)}` };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: `${toolName} returned unexpected shape: ${typeof parsed}.` };
  }
  return { ok: true, value: parsed as Record<string, unknown> };
}

function parseWallet(r: unknown, tokenId: string): {
  tokenId: string;
  owner: string;
  canonicalTba: string;
  deployed: boolean;
  activationRequired: boolean;
  controller: string;
} {
  const raw = textOf(r as { content?: Array<{ type: string; text: string }> });
  const result = safeParseObject(raw, 'get_neon_wallet');
  if (!result.ok) {
    throw new Error(result.error);
  }
  const obj = result.value;
  const walletObj = obj.wallet as { deployed?: unknown; activationRequired?: unknown; controller?: unknown; owner?: unknown } | undefined;
  return {
    tokenId,
    owner: typeof obj.owner === 'string' ? obj.owner : '',
    canonicalTba: (typeof obj.canonicalTba === 'string' ? obj.canonicalTba : (typeof obj.walletAddress === 'string' ? obj.walletAddress : '')),
    deployed: Boolean(obj.deployed ?? walletObj?.deployed ?? true),
    activationRequired: Boolean(obj.activationRequired ?? walletObj?.activationRequired ?? false),
    controller: (typeof obj.controller === 'string' ? obj.controller : (typeof walletObj?.controller === 'string' ? walletObj.controller : (typeof obj.owner === 'string' ? obj.owner : ''))),
  };
}

function parseAssets(r: unknown): PassportData['balances'] {
  const raw = textOf(r as { content?: Array<{ type: string; text: string }> });
  const result = safeParseObject(raw, 'get_neon_assets');
  if (!result.ok) {
    throw new Error(result.error);
  }
  const obj = result.value;
  const walletObj = obj.wallet as { balances?: unknown } | undefined;
  // Defensive: some response shapes wrap `balances` inside `wallet` (real MCP) or
  // expose it as a top-level array. Normalize to an array before handing back.
  const rawBalances: unknown[] = Array.isArray(obj.balances)
    ? (obj.balances as unknown[])
    : Array.isArray(walletObj?.balances)
    ? (walletObj!.balances as unknown[])
    : [];
  const nativeObj = obj.native as { symbol?: unknown; raw?: unknown; decimals?: unknown } | undefined;
  return {
    native: {
      symbol: typeof nativeObj?.symbol === 'string' ? nativeObj.symbol : 'ETH',
      raw: typeof nativeObj?.raw === 'string' ? nativeObj.raw : '0',
      decimals: typeof nativeObj?.decimals === 'number' ? nativeObj.decimals : 18,
    },
    balances: rawBalances as PassportData['balances']['balances'],
    tradingEnabled: Boolean((obj.ccff00 as { tradingEnabled?: unknown } | undefined)?.tradingEnabled ?? false),
    locked: Boolean((obj.ccff00 as { locked?: unknown } | undefined)?.locked ?? true),
  };
}

function parseActivity(r: unknown) {
  try {
    const obj = JSON.parse(textOf(r as { content?: Array<{ type: string; text: string }> }));
    return { items: obj.items ?? [], hasMore: !!obj.hasMore };
  } catch {
    return { items: [], hasMore: false };
  }
}
