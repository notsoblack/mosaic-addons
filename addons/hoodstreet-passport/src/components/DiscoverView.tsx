/**
 * HoodStreet Passport — Discover view
 *
 * Surfaces HoodStreet-curated mint profiles. Diffs against the last seen
 * snapshot to highlight new entries.
 */

import { useEffect, useState } from 'react';
import type { AddonAPI } from '../types/addonApi';
import { callHoodstreetTool, resolveMcp, type McpMode } from '../lib/mcp';
import { readJson, writeJson } from '../lib/persistence';

interface Props {
  api: AddonAPI | undefined;
  bridgeReady: boolean;
}

interface Profile {
  id: string;
  name?: string;
  contract?: string;
  description?: string;
  [k: string]: unknown;
}

export function DiscoverView({ api: apiProp, bridgeReady }: Props) {
  const [mode, setMode] = useState<McpMode>('demo');
  const [modeReason, setModeReason] = useState('waiting for bridge…');
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  function liveApi(): AddonAPI | undefined {
    return apiProp ?? (window.addonAPI as AddonAPI | undefined);
  }

  async function run() {
    setLoading(true);
    setError(null);
    const api = liveApi();
    try {
      const resolution = await resolveMcp(api);
      setMode(resolution.mode);
      setModeReason(resolution.reason);
      const res = await callHoodstreetTool(api, resolution, 'list_nft_mint_profiles', {});
      const list = parseProfiles(res);
      const lastSeen = await readJson<{ ids: string[]; at: string }>(api, 'mints/last-seen.json');
      const currentIds = list.map((p) => p.id);
      const fresh = lastSeen ? currentIds.filter((id) => !lastSeen.ids.includes(id)) : [];
      await writeJson(api, 'mints/last-seen.json', { ids: currentIds, at: new Date().toISOString() });
      setProfiles(list);
      setNewIds(fresh);
      setLastSeenAt(lastSeen?.at ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!bridgeReady) return;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeReady]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-mosaic-text">HoodStreet-curated mints</h2>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-md border border-mosaic-border text-mosaic-textMuted hover:border-mosaic-primary hover:text-mosaic-primary disabled:opacity-50 transition-colors"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="text-xs px-3 py-2 rounded-md border bg-mosaic-surface border-mosaic-border text-mosaic-textMuted">
        <span className="font-semibold mr-1">MCP mode:</span>
        <span className="font-mono">{mode}</span>
        <span className="mx-1.5 opacity-60">·</span>
        <span>{modeReason}</span>
      </div>

      {error && (
        <div className="p-3 rounded-md border border-mosaic-danger/50 bg-mosaic-danger/10 text-mosaic-danger text-sm">
          {error}
        </div>
      )}

      {profiles.length === 0 && !loading && !error && (
        <div className="p-6 rounded-lg border border-dashed border-mosaic-border bg-mosaic-surface text-center">
          <p className="text-mosaic-textMuted text-sm">
            No mint profiles registered yet.
          </p>
          <p className="text-mosaic-muted text-xs mt-1">
            The HoodStreet team adds new mints here when they're ready for public discovery.
          </p>
        </div>
      )}

      {profiles.length > 0 && (
        <ul className="space-y-2">
          {profiles.map((p) => {
            const isNew = newIds.includes(p.id);
            return (
              <li
                key={p.id}
                className={`p-3 rounded-lg border ${
                  isNew
                    ? 'border-hoodstreet/40 bg-hoodstreet/5'
                    : 'border-mosaic-border bg-mosaic-surface'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-mosaic-text font-semibold flex items-center gap-2">
                      {p.name ?? p.id}
                      {isNew && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-hoodstreet text-mosaic-bg font-bold">
                          new
                        </span>
                      )}
                    </div>
                    {p.description && <div className="text-xs text-mosaic-textMuted mt-1">{p.description}</div>}
                  </div>
                  {p.contract && <code className="text-[10px] text-mosaic-muted font-mono">{p.contract.slice(0, 10)}…</code>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {lastSeenAt && (
        <p className="text-[10px] text-mosaic-muted">Last seen: <span className="font-mono">{lastSeenAt}</span></p>
      )}
    </div>
  );
}

function parseProfiles(r: unknown): Profile[] {
  const text = (r as { content?: Array<{ type: string; text: string }> })?.content?.map((c) => c.text).join('') ?? '[]';
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as Profile[];
    if (Array.isArray(parsed?.profiles)) return parsed.profiles as Profile[];
    return [];
  } catch {
    return [];
  }
}
