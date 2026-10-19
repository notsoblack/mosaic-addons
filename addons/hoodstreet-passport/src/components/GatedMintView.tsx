/**
 * HoodStreet Passport v0.2.2 — Gated Mint sub-view.
 *
 * SECURITY (v0.2.2, after live-chain verification):
 *
 * The HoodStreetMemberPassport contract (v0.2.1) requires msg.sender
 * to be the configured TBA itself, not an EOA. A direct mint from the
 * connected EOA reverts with CallerNotTBA.
 *
 * On 2026-10-11 we fetched the deployed TBA bytecode for Neon #7980
 * (0x55DC48c2017ecb576f5Ab247B01A69aA271C1351) and verified:
 *   - The TBA is a 173-byte EIP-1167 minimal proxy that delegates to
 *     the implementation at 0x03dA8C9df253a4401b08629a6F50E4c4E8e248cC
 *   - owner() works on the TBA and returns the parent EOA
 *   - executeCall(address,uint256,bytes) — selector 0x6b61b6e8 — reverts
 *   - execute(address,uint256,bytes,uint8) — selector 0x5fd9ae2e — reverts
 *
 * Conclusion: the HoodStreet TBA does NOT support external calls.
 * The user's EOA cannot forward a mint through the TBA. The ONLY
 * working mint path is the HoodStreet MCP's `prepare_wallet_action`,
 * which has internal knowledge of the TBA's execution semantics.
 *
 * This sub-view therefore:
 *   1. Refuses to attempt direct TBA execution (we know it reverts).
 *   2. Surfaces the HoodStreet MCP's prepare_wallet_action path.
 *   3. If the MCP is not available, refuses to proceed and tells the
 *      user the mint is not possible from this addon.
 *
 * The 3-check gate in the contract is still correct — it does
 * protect against a wrong-EOA mint. It's just that the only
 * way to get a "right" EOA in HoodStreet's architecture is via
 * their MCP, not via a direct TBA call.
 */

import { useState, useEffect } from 'react';
import type { AddonAPI } from '../types/addonApi';
import { publicClient as getPublic } from '../lib/viem';
import { HOODSTREET_MEMBER_PASSPORT_ABI } from '../lib/contractTemplate';
import { readGateState, type GateState, gateGuidance } from '../lib/contractDeploy';
import { resolveMcp, callHoodstreetTool, type McpMode } from '../lib/mcp';
import { shortenAddress } from '../lib/formatters';

interface Props {
  api: AddonAPI | undefined;
  bridgeReady: boolean;
}

type Status = 'idle' | 'checking' | 'ready' | 'minting' | 'minted' | 'error';

export function GatedMintView({ api, bridgeReady }: Props) {
  const [contractAddress, setContractAddress] = useState('');
  const [recipient, setRecipient] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<GateState | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [connectedEOA, setConnectedEOA] = useState<string | null>(null);
  const [mcpMode, setMcpMode] = useState<McpMode>('demo');
  const [mcpModeReason, setMcpModeReason] = useState('initializing');

  useEffect(() => {
    if (!bridgeReady || !api) return;
    (async () => {
      try {
        const r = await resolveMcp(api);
        setMcpMode(r.mode);
        setMcpModeReason(r.reason);
      } catch (err) {
        setMcpModeReason((err as Error).message);
      }
    })();
  }, [api, bridgeReady]);

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;
      const eth = (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<string[]> } }).ethereum;
      if (!eth) return;
      try {
        const accounts = await eth.request({ method: 'eth_accounts' });
        setConnectedEOA(accounts[0] ?? null);
      } catch {
        setConnectedEOA(null);
      }
    })();
  }, []);

  async function checkGate() {
    if (!contractAddress.startsWith('0x') || contractAddress.length !== 42) {
      setError('Enter a valid contract address (0x... 40 hex chars)');
      return;
    }
    setStatus('checking');
    setError(null);
    try {
      const gs = await readGateState(contractAddress as `0x${string}`);
      setGate(gs);
      setStatus('ready');
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    }
  }

  async function mint() {
    if (!gate) return;
    const guidance = gateGuidance(gate);
    if (guidance.status !== 'ready') {
      setError(`Gate is not ready: ${guidance.message}`);
      return;
    }
    setStatus('minting');
    setError(null);
    try {
      if (mcpMode !== 'addon-bridge' || !api) {
        throw new Error(
          'The HoodStreet TBA does not support external calls. The only way to mint ' +
          'a gated sub-passport is through the HoodStreet MCP prepare_wallet_action ' +
          'tool. Add the HoodStreet MCP to MosAIc (Settings → MCP Servers) and reload ' +
          'this addon.'
        );
      }

      // Use the HoodStreet MCP's prepare_wallet_action. It internally
      // handles the TBA's execution semantics. The MCP returns either
      // a txHash (the operation was executed server-side) or an
      // operationId that the user signs in Robinhood Wallet.
      const parentTokenId = gate.gatingTokenId.toString();
      const { encodeFunctionData } = await import('viem');
      const innerData = encodeFunctionData({
        abi: HOODSTREET_MEMBER_PASSPORT_ABI as readonly unknown[],
        functionName: quantity === '1' ? 'mintTo' : 'batchMintTo',
        args: quantity === '1' ? [recipient as `0x${string}`] : [recipient as `0x${string}`, BigInt(quantity)],
      });
      const r = await callHoodstreetTool(api, { mode: 'addon-bridge', serverId: 'hoodstreet', reason: '' }, 'prepare_wallet_action', {
        tokenId: parentTokenId,
        walletType: 'ccff00-erc6551',
        action: 'call',
        contract: contractAddress,
        data: innerData,
      });
      const text = r.content?.[0]?.text ?? '{}';
      const parsed = JSON.parse(text) as { operationId?: string; txHash?: string };
      if (parsed.txHash) {
        setTxHash(parsed.txHash);
        await getPublic().waitForTransactionReceipt({ hash: parsed.txHash as `0x${string}` });
        setStatus('minted');
        return;
      }
      throw new Error(
        `MCP returned an operation (id=${parsed.operationId ?? 'unknown'}). ` +
        `This is the normal HoodStreet caller-signed flow — sign it in Robinhood Wallet.`
      );
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    }
  }

  // Derived gate state for the UI
  const guidance = gate ? gateGuidance(gate) : null;
  const connectedEOAControlsTBA = !!(connectedEOA && gate && gate.tbaOwner && connectedEOA.toLowerCase() === gate.tbaOwner.toLowerCase());
  const canSign = !!(gate && guidance?.status === 'ready' && mcpMode === 'addon-bridge');

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border border-mosaic-danger/30 bg-mosaic-danger/5">
        <p className="text-xs text-mosaic-danger leading-relaxed">
          <strong>v0.2.2 finding (verified on mainnet 2026-10-11):</strong> The HoodStreet TBA does not
          expose <code className="font-mono">executeCall</code> or <code className="font-mono">execute</code> —
          both selectors revert. The only way to mint a gated sub-passport is via the{' '}
          <code className="font-mono">prepare_wallet_action</code> MCP tool, which handles the
          TBA's internal execution path. A direct EOA call to the sub-collection's{' '}
          <code className="font-mono">mintTo</code> will revert with <code className="font-mono">CallerNotTBA</code>.
          <strong>You must have the HoodStreet MCP registered in MosAIc.</strong>
        </p>
      </div>

      <div className="p-4 rounded-lg border border-mosaic-border bg-mosaic-surface">
        <p className="text-xs text-mosaic-textMuted leading-relaxed mb-3">
          Mint a sub-passport from a deployed HoodStreetMemberPassport contract. The MCP prepares the
          TBA-execution transaction; you sign it in Robinhood Wallet.
        </p>
        <label className="block mb-2">
          <span className="block text-xs text-mosaic-textMuted mb-1">Sub-collection contract address</span>
          <input type="text" value={contractAddress} onChange={(e) => setContractAddress(e.target.value)} placeholder="0x..."
            className="w-full px-3 py-2 rounded-md bg-mosaic-bg border border-mosaic-border text-mosaic-text font-mono text-xs focus:outline-none focus:border-mosaic-primary" />
        </label>
        <label className="block mb-2">
          <span className="block text-xs text-mosaic-textMuted mb-1">Recipient</span>
          <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x..."
            className="w-full px-3 py-2 rounded-md bg-mosaic-bg border border-mosaic-border text-mosaic-text font-mono text-xs focus:outline-none focus:border-mosaic-primary" />
        </label>
        <label className="block mb-3">
          <span className="block text-xs text-mosaic-textMuted mb-1">Quantity (max 50 per call)</span>
          <input type="text" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} placeholder="1"
            className="w-24 px-3 py-2 rounded-md bg-mosaic-bg border border-mosaic-border text-mosaic-text font-mono text-xs focus:outline-none focus:border-mosaic-primary" />
        </label>
        <div className="text-xs px-3 py-2 rounded-md border bg-mosaic-surface border-mosaic-border text-mosaic-textMuted mb-3">
          <span className="font-semibold mr-1">MCP mode:</span> <span className="font-mono">{mcpMode}</span>
          <span className="mx-1.5 opacity-60">·</span>
          <span>{mcpModeReason}</span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={checkGate} disabled={status === 'checking'}
            className="px-3 py-1.5 text-xs rounded-md border border-mosaic-border text-mosaic-textMuted hover:border-mosaic-primary hover:text-mosaic-primary disabled:opacity-50">
            {status === 'checking' ? 'Checking…' : 'Check gate'}
          </button>
          <button type="button" onClick={mint} disabled={!canSign || status === 'minting' || !recipient.startsWith('0x') || !contractAddress.startsWith('0x')}
            className="px-3 py-1.5 text-xs rounded-md bg-mosaic-primary text-mosaic-bg font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
            {status === 'minting' ? 'Preparing…' : 'Mint via MCP'}
          </button>
        </div>
      </div>

      {gate && (
        <div className="p-4 rounded-lg border border-mosaic-border bg-mosaic-surface text-xs">
          <div className="flex justify-between py-1">
            <span className="text-mosaic-textMuted">Gate</span>
            <span className={guidance?.status === 'ready' ? 'text-mosaic-success' : 'text-mosaic-warning'}>
              {guidance?.status === 'ready' ? 'OPEN' : 'CLOSED'}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-mosaic-textMuted">Parent owner</span>
            <span className="font-mono text-mosaic-text">{shortenAddress(gate.currentParentOwner)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-mosaic-textMuted">TBA owner (verified on chain)</span>
            <span className={`font-mono ${connectedEOAControlsTBA ? 'text-mosaic-success' : 'text-mosaic-warning'}`}>
              {shortenAddress(gate.tbaOwner)}{connectedEOAControlsTBA ? ' ✓' : ''}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-mosaic-textMuted">Gating tokenId</span>
            <span className="font-mono text-mosaic-text">#{gate.gatingTokenId.toString()}</span>
          </div>
          {guidance && guidance.status !== 'ready' && (
            <div className="mt-2 p-2 rounded border border-mosaic-warning/30 bg-mosaic-warning/5 text-mosaic-warning text-[10px]">
              {guidance.message}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-md border border-mosaic-danger/50 bg-mosaic-danger/10 text-mosaic-danger text-xs">
          {error}
        </div>
      )}

      {txHash && status === 'minted' && (
        <div className="p-4 rounded-lg border border-mosaic-success/30 bg-mosaic-success/10 text-xs">
          <p className="text-mosaic-success font-semibold mb-1">✓ Minted</p>
          <pre className="text-mosaic-text font-mono break-all">{txHash}</pre>
          <p className="text-mosaic-textMuted mt-1">View on{' '}
            <a
              href={`https://robinhoodchain.blockscout.com/tx/${txHash}`}
              onClick={(e) => { e.preventDefault(); if (api?.ui?.openExternal) void api.ui.openExternal(`https://robinhoodchain.blockscout.com/tx/${txHash}`); }}
              className="text-mosaic-primary hover:underline"
            >Blockscout ↗</a>
          </p>
        </div>
      )}
    </div>
  );
}
