/**
 * HoodStreet Passport — Tools view (v0.4)
 *
 * Comprehensive catalog of all 33 tools exposed by the live HoodStreet MCP
 * (https://agent.hoodstreet.capital/mcp), grouped by access pattern:
 *
 *   read     — non-custodial, no signing. Safe to invoke from the user's
 *              wallet. Always callable.
 *   prepare  — produces an unsigned payload for the user to sign in their
 *              own wallet. Non-custodial.
 *   execute  — uses the server's signer (operator-only). NOT non-custodial
 *              from the addon's perspective; flagged clearly in the UI.
 *
 * The Tools view is the single most useful thing to show the HoodStreet
 * founder: it demonstrates complete MCP coverage in one place. Read-only
 * tools have inline "Run" buttons; the others show their argument shape
 * and an explanation of the custody model.
 *
 * The 8 tools already wired into dedicated sub-views (Passport, Discover,
 * Inventory, Archived GatedMintView) are still wired there too — this view
 * is an at-a-glance catalog, not a replacement.
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

const CATEGORY_ORDER: Array<'read' | 'prepare' | 'execute'> = ['read', 'prepare', 'execute'];
const CATEGORY_LABEL: Record<'read' | 'prepare' | 'execute', string> = {
  read: 'Read-only (non-custodial)',
  prepare: 'Prepare (user signs in their own wallet)',
  execute: 'Execute (operator-only — server signer)',
};
const CATEGORY_BADGE_CLASS: Record<'read' | 'prepare' | 'execute', string> = {
  read: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  prepare: 'bg-cyan-900/40 text-cyan-300 border-cyan-700/50',
  execute: 'bg-amber-900/40 text-amber-300 border-amber-700/50',
};

function ToolCard({
  tool,
  api,
  resolution,
  mode,
}: {
  tool: McpToolInfo;
  api: AddonAPI | undefined;
  resolution: Awaited<ReturnType<typeof resolveMcp>>;
  mode: McpMode;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [args, setArgs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (tool.args) {
      for (const k of Object.keys(tool.args)) {
        // Pre-fill the few well-known keys with sensible defaults
        if (k === 'tokenId') init[k] = '7980';
        else if (k === 'walletType') init[k] = 'ccff00-erc6551';
        else init[k] = '';
      }
    }
    return init;
  });

  const category = tool.category ?? 'read';
  const canRun = mode === 'addon-bridge' && category === 'read' && tool.args && Object.keys(tool.args).length > 0;
  const disabledReason =
    mode !== 'addon-bridge' ? 'MCP not in addon-bridge mode'
    : category !== 'read' ? `non-runable: ${category} tool — user signs externally`
    : !tool.args || Object.keys(tool.args).length === 0 ? 'no arguments'
    : null;

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(args)) {
        if (v === '') continue;
        // try to parse numbers / booleans if the value looks like one
        if (/^-?\d+$/.test(v)) cleaned[k] = Number(v);
        else if (v === 'true' || v === 'false') cleaned[k] = v === 'true';
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
    <div className="rounded-lg border border-mosaic-border bg-mosaic-surface p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-sm font-mono text-cyan-300 break-all">{tool.name}</code>
            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${CATEGORY_BADGE_CLASS[category]}`}>
              {category}
            </span>
          </div>
          {tool.description && (
            <p className="text-xs text-mosaic-textMuted mt-1.5 leading-relaxed">{tool.description}</p>
          )}
        </div>
        {canRun && (
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="flex-shrink-0 px-3 py-1.5 text-xs rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running ? 'Running…' : 'Run'}
          </button>
        )}
      </div>

      {tool.args && Object.keys(tool.args).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(tool.args).map(([k, hint]) => (
            <label key={k} className="block">
              <span className="block text-[10px] text-mosaic-muted font-mono mb-0.5">{k}</span>
              <input
                type="text"
                value={args[k] ?? ''}
                onChange={(e) => setArgs((a) => ({ ...a, [k]: e.target.value }))}
                placeholder={hint}
                className="w-full px-2 py-1 text-xs rounded bg-mosaic-bg border border-mosaic-border text-mosaic-text font-mono focus:outline-none focus:border-cyan-500"
              />
            </label>
          ))}
        </div>
      )}

      {disabledReason && (
        <p className="text-[10px] text-mosaic-muted italic">{disabledReason}</p>
      )}

      {result && (
        <div className={`mt-2 p-2 rounded border text-[10px] font-mono whitespace-pre-wrap break-all max-h-48 overflow-auto ${
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
  );
}

export function ToolsView({ api: apiProp, bridgeReady }: Props) {
  const [mode, setMode] = useState<McpMode>('demo');
  const [modeReason, setModeReason] = useState('resolving MCP…');
  const [resolution, setResolution] = useState<Awaited<ReturnType<typeof resolveMcp>> | null>(null);
  const [liveTools, setLiveTools] = useState<McpToolInfo[] | null>(null);
  const [search, setSearch] = useState('');

  // Re-resolve the api on every read so we pick up the bridge once it mounts.
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

  // Use live tools from MCP if available; fall back to our known-to-locally-stored catalog.
  const tools = useMemo(() => {
    const base = liveTools && liveTools.length > 0 ? liveTools : KNOWN_HOODSTREET_TOOLS;
    // Augment with our category + args metadata
    return base.map((t) => {
      const local = KNOWN_HOODSTREET_TOOLS.find((k) => k.name === t.name);
      return local ?? t;
    });
  }, [liveTools]);

  // Group by category
  const grouped = useMemo(() => {
    const byCat: Record<string, McpToolInfo[]> = { read: [], prepare: [], execute: [] };
    const q = search.trim().toLowerCase();
    for (const t of tools) {
      const cat = t.category ?? 'read';
      if (q && !`${t.name} ${t.description ?? ''}`.toLowerCase().includes(q)) continue;
      (byCat[cat] ??= []).push(t);
    }
    return byCat;
  }, [tools, search]);

  const counts = useMemo(() => {
    const c = { read: 0, prepare: 0, execute: 0 };
    for (const t of tools) c[(t.category ?? 'read')]++;
    return c;
  }, [tools]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-mosaic-text">All 33 HoodStreet MCP tools</h2>
          <p className="text-xs text-mosaic-textMuted mt-1">
            Read-only tools run live here. Prepare tools show the unsigned payload. Execute tools
            require operator mode and are documented for transparency.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded border ${
            mode === 'addon-bridge' ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50'
            : mode === 'not-configured' ? 'bg-amber-900/40 text-amber-300 border-amber-700/50'
            : 'bg-mosaic-bg text-mosaic-muted border-mosaic-border'
          }`}>
            {mode}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] text-mosaic-textMuted">
        <span className="px-2 py-1 rounded bg-mosaic-surface border border-mosaic-border">{counts.read} read-only</span>
        <span className="px-2 py-1 rounded bg-mosaic-surface border border-mosaic-border">{counts.prepare} prepare</span>
        <span className="px-2 py-1 rounded bg-mosaic-surface border border-mosaic-border">{counts.execute} execute (operator)</span>
        <span className="px-2 py-1 rounded bg-mosaic-surface border border-mosaic-border">{tools.length} total</span>
      </div>

      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter tools by name or description…"
          className="w-full px-3 py-2 text-sm rounded-md bg-mosaic-bg border border-mosaic-border text-mosaic-text placeholder:text-mosaic-muted focus:outline-none focus:border-cyan-500"
        />
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const list = grouped[cat] ?? [];
        if (list.length === 0) return null;
        return (
          <section key={cat} className="space-y-2">
            <h3 className="text-sm font-semibold text-mosaic-text flex items-center gap-2">
              {CATEGORY_LABEL[cat]}
              <span className="text-[10px] font-mono text-mosaic-muted bg-mosaic-bg border border-mosaic-border rounded px-1.5 py-0.5">
                {list.length}
              </span>
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {list.map((t) => (
                <ToolCard key={t.name} tool={t} api={liveApi()} resolution={resolution!} mode={mode} />
              ))}
            </div>
          </section>
        );
      })}

      {tools.length === 0 && (
        <div className="p-6 rounded-lg border border-dashed border-mosaic-border bg-mosaic-surface text-center text-mosaic-textMuted text-sm">
          No tools available. {modeReason}
        </div>
      )}

      <p className="text-[10px] text-mosaic-muted leading-relaxed">
        {modeReason}. {liveTools ? `Live MCP returned ${liveTools.length} tools.` : 'Using locally-known catalog (live MCP not in bridge mode).'}
      </p>
    </div>
  );
}
