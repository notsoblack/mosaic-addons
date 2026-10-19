/**
 * HoodStreet Passport — Tools view (v0.4.1)
 *
 * Dense, working catalog of HoodStreet MCP tools. Two sections:
 *
 *   1. **Primary (15 tools)**: read-only tools that the addon can run live.
 *      These are the tools that demonstrate "this addon works against the
 *      real HoodStreet MCP". Eight were already wired into dedicated
 *      sub-views; seven are surfaced for the first time.
 *
 *   2. **Advanced (collapsed by default, 18 tools)**: prepare_*, simulate_*,
 *      confirm_*, execute_*, marketplace, CCFF00 mainnet mint, post-to-x.
 *      These need either user-side signing (we don't custody keys) or
 *      operator mode (server signer — out of scope for a non-custodial
 *      addon). Click "Show advanced tools" to see them with their
 *      argument shapes and explanations.
 *
 * Per-tool row is one line (name + description + Run button). Clicking
 * Run opens a modal with the argument form, then shows the response
 * inline below.
 *
 * Category labels (deliberately not the MCP's internal naming):
 *   - READ = read-only, runs live, no signing
 *   - SIGN = prepare/confirm; user signs in their own wallet
 *   - OPER = operator-only; server signer, not for end users
 */
import { useEffect, useMemo, useState } from 'react';
import type { AddonAPI, McpToolInfo } from '../types/addonApi';
import { callHoodstreetTool, listHoodstreetTools, resolveMcp, type McpMode } from '../lib/mcp';
import { KNOWN_HOODSTREET_TOOLS } from '../lib/mcp';

interface Props {
  api: AddonAPI | undefined;
  bridgeReady: boolean;
}

type Status = 'idle' | 'running' | 'success' | 'error';
interface RunResult { status: Status; text: string; at: string; }

/**
 * The 15 "primary" tools — read-only, this addon can run them live.
 * Curated subset of KNOWN_HOODSTREET_TOOLS. Each tool's args + category
 * are already in KNOWN_HOODSTREET_TOOLS; this list just controls the
 * order and which ones appear in the primary view.
 */
const PRIMARY_TOOL_NAMES: string[] = [
  // 8 originally wired into dedicated sub-views
  'get_neon_wallet',
  'get_neon_assets',
  'get_neon_balances',
  'get_neon_activity',
  'discover_wallet_nfts',
  'list_nft_mint_profiles',
  'get_neon_trade_quote',
  'prepare_wallet_action', // also surfaced in archived GatedMintView
  // 7 newly surfaced
  'get_wallet_token',
  'get_wallet_nft',
  'discover_wallet_tokens',
  'get_wallet_action_status',
  'get_neon_trade_status',
  'get_nft_mint_status',
  'get_ccff00_mint_status',
];

const CATEGORY_LABEL: Record<'read' | 'prepare' | 'execute', string> = {
  read: 'READ',
  prepare: 'SIGN',
  execute: 'OPER',
};
const CATEGORY_CLASS: Record<'read' | 'prepare' | 'execute', string> = {
  read: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  prepare: 'bg-cyan-900/40 text-cyan-300 border-cyan-700/50',
  execute: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
};
const CATEGORY_LONG: Record<'read' | 'prepare' | 'execute', string> = {
  read: 'Read-only — runs live, no signing',
  prepare: 'Sign-required — user signs in their own wallet',
  execute: 'Operator-only — server signer, not for end users',
};

function ToolRow({
  tool,
  onRunClick,
}: {
  tool: McpToolInfo;
  onRunClick: (tool: McpToolInfo) => void;
}) {
  const category = tool.category ?? 'read';
  const buttonLabel = category === 'read' ? 'Run →' : 'Info →';
  return (
    <div className="flex items-center gap-3 py-2 px-3 border-b border-mosaic-border/50 last:border-b-0 hover:bg-mosaic-bg/40 transition-colors">
      <span
        className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 ${CATEGORY_CLASS[category]}`}
        title={CATEGORY_LONG[category]}
      >
        {CATEGORY_LABEL[category]}
      </span>
      <code className="text-xs font-mono text-cyan-300 flex-shrink-0">{tool.name}</code>
      <span className="text-xs text-mosaic-textMuted flex-1 min-w-0 truncate" title={tool.description}>
        {tool.description}
      </span>
      <button
        type="button"
        onClick={() => onRunClick(tool)}
        className="flex-shrink-0 px-2.5 py-1 text-[11px] rounded bg-mosaic-bg border border-mosaic-border text-mosaic-text hover:border-cyan-500 hover:text-cyan-300 transition-colors"
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function ToolRunnerModal({
  tool,
  onClose,
  api,
  resolution,
  mode,
}: {
  tool: McpToolInfo;
  onClose: () => void;
  api: AddonAPI | undefined;
  resolution: Awaited<ReturnType<typeof resolveMcp>>;
  mode: McpMode;
}) {
  const [args, setArgs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (tool.args) {
      for (const k of Object.keys(tool.args)) {
        if (k === 'tokenId') init[k] = '7980';
        else if (k === 'walletType') init[k] = 'ccff00-erc6551';
        else init[k] = '';
      }
    }
    return init;
  });
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);

  const category = tool.category ?? 'read';
  const canRun = mode === 'addon-bridge' && category === 'read';

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      // Pass strings as strings. The HoodStreet MCP validates types strictly
      // and rejects numbers where strings are expected (e.g. tokenId).
      // Booleans are recognized by their literal "true" / "false" string.
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v === '') continue;
        if (v === 'true') cleaned[k] = true;
        else if (v === 'false') cleaned[k] = false;
        else cleaned[k] = v;
      }
      const r = await callHoodstreetTool(api, resolution, tool.name, cleaned);
      const text = r.content?.[0]?.text ?? JSON.stringify(r);
      const isErr = r.isError || /^\s*\{[^}]*"error"/.test(text ?? '');
      setResult({ status: isErr ? 'error' : 'success', text, at: new Date().toISOString() });
    } catch (e) {
      setResult({ status: 'error', text: (e as Error).message, at: new Date().toISOString() });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-mosaic-bg border border-mosaic-border rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 p-4 border-b border-mosaic-border">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-sm font-mono text-cyan-300">{tool.name}</code>
              <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${CATEGORY_CLASS[category]}`}>
                {CATEGORY_LABEL[category]}
              </span>
            </div>
            {tool.description && (
              <p className="text-xs text-mosaic-textMuted mt-1.5 leading-relaxed">{tool.description}</p>
            )}
            {category !== 'read' && (
              <p className="text-[11px] text-amber-300 mt-2 italic">
                {CATEGORY_LONG[category]}. This tool cannot be invoked from this add-on.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-mosaic-muted hover:text-mosaic-text text-xl leading-none p-1"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tool.args && Object.keys(tool.args).length > 0 && (
            <div className="space-y-2">
              {Object.entries(tool.args).map(([k, hint]) => (
                <label key={k} className="block">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-mosaic-muted font-mono">{k}</span>
                    <span className="text-[9px] text-mosaic-muted italic">{hint}</span>
                  </div>
                  <input
                    type="text"
                    value={args[k] ?? ''}
                    onChange={(e) => setArgs((a) => ({ ...a, [k]: e.target.value }))}
                    className="w-full px-2 py-1.5 text-xs rounded bg-mosaic-surface border border-mosaic-border text-mosaic-text font-mono focus:outline-none focus:border-cyan-500"
                  />
                </label>
              ))}
            </div>
          )}

          {result && (
            <div className={`p-3 rounded border text-[11px] font-mono whitespace-pre-wrap break-all max-h-64 overflow-auto ${
              result.status === 'success'
                ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200'
                : 'bg-rose-950/40 border-rose-800/50 text-rose-200'
            }`}>
              <div className="flex justify-between items-center mb-1 text-[9px] uppercase tracking-wider opacity-70">
                <span>{result.status === 'success' ? '✓ ok' : '✗ error'}</span>
                <span>{result.at}</span>
              </div>
              {result.text}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 p-3 border-t border-mosaic-border">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded text-mosaic-textMuted hover:text-mosaic-text"
          >
            Close
          </button>
          {canRun && (
            <button
              type="button"
              onClick={run}
              disabled={running}
              className="px-3 py-1.5 text-xs rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? 'Running…' : 'Run'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

export function ToolsView({ api: apiProp, bridgeReady }: Props) {
  const [mode, setMode] = useState<McpMode>('demo');
  const [modeReason, setModeReason] = useState('resolving MCP…');
  const [resolution, setResolution] = useState<Awaited<ReturnType<typeof resolveMcp>> | null>(null);
  const [liveTools, setLiveTools] = useState<McpToolInfo[] | null>(null);
  const [search, setSearch] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [runnerTool, setRunnerTool] = useState<McpToolInfo | null>(null);

  function liveApi(): AddonAPI | undefined {
    return apiProp ?? (window.addonAPI as AddonAPI | undefined);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const api = liveApi();
      if (!api) return;
      const r = await resolveMcp(api);
      if (cancelled) return;
      setMode(r.mode);
      setModeReason(r.reason);
      setResolution(r);
      if (r.mode === 'addon-bridge') {
        const tools = await listHoodstreetTools(api, r);
        if (!cancelled) setLiveTools(tools);
      }
    })();
    return () => { cancelled = true; };
  }, [bridgeReady]);

  // Merge live tools with our locally-stored metadata (category + args).
  // Live takes precedence for the name + description, but our local copy
  // wins for category + args (we don't ship a wire format for those).
  const toolsByName = useMemo(() => {
    const m = new Map<string, McpToolInfo>();
    for (const t of KNOWN_HOODSTREET_TOOLS) m.set(t.name, t);
    if (liveTools) for (const t of liveTools) {
      const local = m.get(t.name);
      m.set(t.name, local ? { ...t, category: local.category, args: local.args } : t);
    }
    return m;
  }, [liveTools]);

  const primaryTools = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PRIMARY_TOOL_NAMES
      .map((n) => toolsByName.get(n))
      .filter((t): t is McpToolInfo => Boolean(t))
      .filter((t) => !q || `${t.name} ${t.description ?? ''}`.toLowerCase().includes(q));
  }, [toolsByName, search]);

  const advancedTools = useMemo(() => {
    const primary = new Set(PRIMARY_TOOL_NAMES);
    const q = search.trim().toLowerCase();
    return Array.from(toolsByName.values())
      .filter((t) => !primary.has(t.name))
      .filter((t) => !q || `${t.name} ${t.description ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [toolsByName, search]);

  const counts = useMemo(() => {
    let read = 0, prepare = 0, execute = 0;
    for (const t of toolsByName.values()) {
      const c = t.category ?? 'read';
      if (c === 'read') read++;
      else if (c === 'prepare') prepare++;
      else execute++;
    }
    return { read, prepare, execute, total: read + prepare + execute };
  }, [toolsByName]);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-mosaic-text">HoodStreet MCP tools</h2>
        <p className="text-xs text-mosaic-textMuted mt-1 leading-relaxed">
          This add-on is <strong className="text-emerald-300">non-custodial</strong>: it never holds keys
          and never signs on your behalf. Tools marked <span className="text-cyan-300">SIGN</span> return
          an unsigned payload for <em>your</em> wallet to sign. Tools marked <span className="text-amber-300">OPER</span>{' '}
          require operator mode and are not callable from this add-on.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[10px] text-mosaic-textMuted">
        <span className="px-2 py-1 rounded bg-mosaic-surface border border-mosaic-border">
          <span className="text-emerald-300 font-semibold">READ</span> {counts.read} (live)
        </span>
        <span className="px-2 py-1 rounded bg-mosaic-surface border border-mosaic-border">
          <span className="text-cyan-300 font-semibold">SIGN</span> {counts.prepare} (your wallet)
        </span>
        <span className="px-2 py-1 rounded bg-mosaic-surface border border-mosaic-border">
          <span className="text-amber-300 font-semibold">OPER</span> {counts.execute} (server signer)
        </span>
        <span className="px-2 py-1 rounded bg-mosaic-surface border border-mosaic-border">
          Total {counts.total}
        </span>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter tools by name or description…"
        className="w-full px-3 py-1.5 text-sm rounded-md bg-mosaic-bg border border-mosaic-border text-mosaic-text placeholder:text-mosaic-muted focus:outline-none focus:border-cyan-500"
      />

      <div className="rounded-lg border border-mosaic-border bg-mosaic-surface overflow-hidden">
        <div className="px-3 py-2 bg-mosaic-bg/60 border-b border-mosaic-border flex items-center justify-between">
          <span className="text-xs font-semibold text-mosaic-text">
            Read-only tools (runs live)
          </span>
          <span className="text-[10px] text-mosaic-muted font-mono">
            {primaryTools.length} of {counts.read}
          </span>
        </div>
        {primaryTools.length === 0 ? (
          <p className="text-xs text-mosaic-muted italic p-3">No read-only tools match your filter.</p>
        ) : (
          primaryTools.map((t) => (
            <ToolRow
              key={t.name}
              tool={t}
              onRunClick={setRunnerTool}
            />
          ))
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-mosaic-textMuted hover:text-mosaic-text flex items-center gap-1.5"
        >
          <span className={`inline-block transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
          {showAdvanced ? 'Hide' : 'Show'} {advancedTools.length} advanced tools
          <span className="text-[10px] italic">(sign-required + operator-only)</span>
        </button>
        {showAdvanced && (
          <div className="mt-2 rounded-lg border border-mosaic-border bg-mosaic-surface overflow-hidden">
            <div className="px-3 py-2 bg-mosaic-bg/60 border-b border-mosaic-border flex items-center justify-between">
              <span className="text-xs font-semibold text-mosaic-text">
                Sign-required &amp; operator-only tools
              </span>
              <span className="text-[10px] text-mosaic-muted font-mono">
                {advancedTools.length} ({counts.prepare} sign + {counts.execute} operator)
              </span>
            </div>
            {advancedTools.length === 0 ? (
              <p className="text-xs text-mosaic-muted italic p-3">No advanced tools match your filter.</p>
            ) : (
              advancedTools.map((t) => (
                <ToolRow
                  key={t.name}
                  tool={t}
                  onRunClick={setRunnerTool}
                />
              ))
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-mosaic-muted leading-relaxed">
        {modeReason}
        {liveTools && ` Live MCP returned ${liveTools.length} tools. `}
        {liveTools && liveTools.length !== counts.total && `Local catalog: ${counts.total}.`}
      </p>

      {runnerTool && (
        <ToolRunnerModal
          tool={runnerTool}
          onClose={() => setRunnerTool(null)}
          api={liveApi()}
          resolution={resolution!}
          mode={mode}
        />
      )}
    </div>
  );
}
