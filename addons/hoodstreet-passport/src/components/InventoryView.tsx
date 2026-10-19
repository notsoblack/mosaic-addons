/**
 * HoodStreet Passport v0.2 — Inventory sub-view.
 *
 * Lists NFTs held in the connected wallet or in a specified TBA.
 * Uses HoodStreet MCP's get_wallet_nft + discover_wallet_nfts for the
 * HoodStreet read path, falls back to viem direct reads for any
 * other contract.
 */

import { useState, useEffect } from 'react';
import type { AddonAPI } from '../types/addonApi';
import { resolveMcp, callHoodstreetTool, type McpMode } from '../lib/mcp';
import { publicClient } from '../lib/viem';
import { shortenAddress } from '../lib/formatters';

interface Props {
  api: AddonAPI | undefined;
  bridgeReady: boolean;
}

interface NftEntry {
  collection: string;
  assetTokenId: string;
  standard: 'ERC-721' | 'ERC-1155';
  source: 'hoodstreet-mcp' | 'viem-direct';
}

export function InventoryView({ api, bridgeReady }: Props) {
  const [tokenId, setTokenId] = useState('');
  const [mcpMode, setMcpMode] = useState<McpMode>('demo');
  const [mcpModeReason, setMcpModeReason] = useState('initializing');
  const [nfts, setNfts] = useState<NftEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<string>('');
  const [collection, setCollection] = useState('');

  // Discover NFTs via HoodStreet MCP for the given tokenId (CCFF00 holder).
  // Returns { items, error? } — `error` is set when the MCP returned a
  // structured error (e.g. Blockscout 403). Callers MUST honor `error`
  // and not treat it as an empty inventory.
  async function discoverViaMcp(id: string): Promise<{ items: unknown[]; error?: string }> {
    const resolution = await resolveMcp(api);
    setMcpMode(resolution.mode);
    setMcpModeReason(resolution.reason);
    if (resolution.mode !== 'addon-bridge' || !api) {
      return { items: [] };
    }
    const r = await callHoodstreetTool(api, resolution, 'discover_wallet_nfts', { tokenId: id, walletType: 'ccff00-erc6551' });
    const raw = r.content?.[0]?.text ?? '';
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { items: [], error: `MCP returned non-JSON: ${raw.slice(0, 200)}` };
    }
    const obj = parsed as { items?: unknown; error?: unknown } | null;
    if (obj && typeof obj === 'object' && typeof obj.error === 'string' && obj.error.length > 0) {
      return { items: [], error: obj.error };
    }
    if (obj && typeof obj === 'object' && Array.isArray(obj.items)) {
      return { items: obj.items };
    }
    return { items: [] };
  }

  // Direct ERC-721 enumeration via viem (for any collection, not just CCFF00)
  async function enumerateDirect(contractAddress: string, owner: string): Promise<NftEntry[]> {
    const client = publicClient();
    // ERC-721 balanceOf
    const balance = await client.readContract({
      address: contractAddress as `0x${string}`,
      abi: [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'o', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }],
      functionName: 'balanceOf',
      args: [owner as `0x${string}`],
    }) as bigint;
    if (balance === 0n) return [];
    // tokenOfOwnerByIndex for each index
    const result: NftEntry[] = [];
    for (let i = 0n; i < balance; i++) {
      try {
        const id = await client.readContract({
          address: contractAddress as `0x${string}`,
          abi: [{ type: 'function', name: 'tokenOfOwnerByIndex', stateMutability: 'view', inputs: [{ name: 'o', type: 'address' }, { name: 'i', type: 'uint256' }], outputs: [{ name: '', type: 'uint256' }] }],
          functionName: 'tokenOfOwnerByIndex',
          args: [owner as `0x${string}`, i],
        }) as bigint;
        result.push({ collection: contractAddress, assetTokenId: id.toString(), standard: 'ERC-721', source: 'viem-direct' });
      } catch {
        // 1155 or non-standard; skip
      }
    }
    return result;
  }

  async function load() {
    if (!wallet.startsWith('0x')) {
      setError('Enter a wallet address (0x...)');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let entries: NftEntry[] = [];
      // 1. If a tokenId is given, use the HoodStreet MCP to discover NFTs in the TBA.
      //    If the MCP returns a structured error (e.g. Blockscout 403), surface
      //    it to the user and skip the MCP path rather than reporting an empty
      //    inventory that would be indistinguishable from a real "no NFTs found".
      if (tokenId && /^[1-9]\d*$/.test(tokenId) && mcpMode === 'addon-bridge') {
        const discovered = await discoverViaMcp(tokenId);
        if (discovered.error) {
          setError(`HoodStreet MCP NFT discovery failed: ${discovered.error}. Try entering a sub-collection contract address below for a direct viem read.`);
        } else {
          for (const item of discovered.items) {
            entries.push({
              collection: (item as { collection?: string }).collection ?? 'unknown',
              assetTokenId: (item as { tokenId?: string }).tokenId ?? 'unknown',
              standard: 'ERC-721',
              source: 'hoodstreet-mcp',
            });
          }
        }
      }
      // 2. If a collection is given, enumerate directly via viem.
      //    This is the recommended path for user-deployed sub-collections
      //    (the Create sub-view is archived in v0.3.0; the contract is
      //    still discoverable by address).
      if (collection.startsWith('0x') && collection.length === 42) {
        const direct = await enumerateDirect(collection, wallet);
        entries = entries.concat(direct);
      }
      setNfts(entries);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (bridgeReady) void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [bridgeReady]);

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border border-mosaic-border bg-mosaic-surface">
        <p className="text-xs text-mosaic-textMuted leading-relaxed mb-3">
          Inventory view. Combines the HoodStreet MCP (for CCFF00 TBA contents) with direct viem reads (for any
          other collection). If you have a sub-collection contract address, enter it below for a direct viem read.
          MCP indexer failures (e.g. Blockscout 403) are surfaced as a distinct error.
        </p>
        <label className="block mb-2">
          <span className="block text-xs text-mosaic-textMuted mb-1">Wallet or TBA address</span>
          <input type="text" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x..."
            className="w-full px-3 py-2 rounded-md bg-mosaic-bg border border-mosaic-border text-mosaic-text font-mono text-xs focus:outline-none focus:border-mosaic-primary" />
        </label>
        <label className="block mb-2">
          <span className="block text-xs text-mosaic-textMuted mb-1">CCFF00 tokenId (optional, uses HoodStreet MCP)</span>
          <input type="text" value={tokenId} onChange={(e) => setTokenId(e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 7980"
            className="w-full px-3 py-2 rounded-md bg-mosaic-bg border border-mosaic-border text-mosaic-text font-mono text-xs focus:outline-none focus:border-mosaic-primary" />
        </label>
        <label className="block mb-3">
          <span className="block text-xs text-mosaic-textMuted mb-1">Sub-collection contract (optional, direct viem read)</span>
          <input type="text" value={collection} onChange={(e) => setCollection(e.target.value)} placeholder="0x..."
            className="w-full px-3 py-2 rounded-md bg-mosaic-bg border border-mosaic-border text-mosaic-text font-mono text-xs focus:outline-none focus:border-mosaic-primary" />
        </label>
        <button type="button" onClick={load} disabled={loading} className="px-3 py-1.5 text-xs rounded-md bg-mosaic-primary text-mosaic-bg font-semibold disabled:opacity-50">
          {loading ? 'Loading…' : 'Load inventory'}
        </button>
      </div>

      <div className="text-xs px-3 py-2 rounded-md border bg-mosaic-surface border-mosaic-border text-mosaic-textMuted">
        <span className="font-semibold mr-1">MCP mode:</span> <span className="font-mono">{mcpMode}</span>
        <span className="mx-1.5 opacity-60">·</span>
        <span>{mcpModeReason}</span>
      </div>

      {error && <div className="p-3 rounded-md border border-mosaic-danger/50 bg-mosaic-danger/10 text-mosaic-danger text-xs">{error}</div>}

      {nfts.length === 0 && !loading && !error && (
        <div className="p-6 rounded-lg border border-dashed border-mosaic-border bg-mosaic-surface text-center text-mosaic-textMuted text-sm">
          No NFTs found. Try entering a wallet address and a CCFF00 tokenId or a sub-collection contract.
        </div>
      )}

      {nfts.length > 0 && (
        <ul className="space-y-2">
          {nfts.map((nft, i) => (
            <li key={i} className="p-3 rounded-lg border border-mosaic-border bg-mosaic-surface text-xs">
              <div className="flex justify-between">
                <span className="font-mono text-mosaic-text">#{nft.assetTokenId}</span>
                <span className="text-mosaic-textMuted">{nft.standard} · {nft.source}</span>
              </div>
              <div className="font-mono text-mosaic-textMuted text-[10px] mt-1 break-all">{shortenAddress(nft.collection, 10, 6)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
