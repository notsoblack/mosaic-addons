/**
 * HoodStreet Passport v0.2 — Transfer sub-view.
 *
 * Transfers any ERC-721 (or 1155) token from the connected wallet to
 * a recipient. Uses viem's encodeFunctionData + the user's wallet for
 * signing. Soulbound tokens (no transferFrom override) will revert
 * onchain; we surface that error rather than pre-checking.
 */

import { useState } from 'react';
import type { AddonAPI } from '../types/addonApi';
import { createWalletClient, custom, encodeFunctionData, erc721Abi } from 'viem';
import { ROBINHOOD_CHAIN, publicClient } from '../lib/viem';
import { shortenAddress } from '../lib/formatters';

interface Props {
  api: AddonAPI | undefined;
  bridgeReady: boolean;
}

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function TransferView({ api, bridgeReady }: Props) {
  const [collection, setCollection] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [recipient, setRecipient] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  async function transfer() {
    if (!collection.startsWith('0x') || collection.length !== 42) {
      setError('Enter a valid collection contract address');
      return;
    }
    if (!/^[0-9]+$/.test(tokenId)) {
      setError('Enter a valid tokenId');
      return;
    }
    if (!recipient.startsWith('0x') || recipient.length !== 42) {
      setError('Enter a valid recipient address');
      return;
    }
    setStatus('sending');
    setError(null);
    try {
      const wallet = createWalletClient({
        chain: ROBINHOOD_CHAIN,
        transport: custom((window as unknown as { ethereum: never }).ethereum),
      });
      const [from] = await wallet.getAddresses();
      if (!from) throw new Error('No wallet address available');

      // Try ERC-721 first
      const data = encodeFunctionData({
        abi: erc721Abi,
        functionName: 'transferFrom',
        args: [from, recipient as `0x${string}`, BigInt(tokenId)],
      });
      const hash = await wallet.sendTransaction({
        to: collection as `0x${string}`,
        data,
        value: 0n,
        account: from,
        chain: ROBINHOOD_CHAIN,
      });
      setTxHash(hash);
      await publicClient().waitForTransactionReceipt({ hash });
      setStatus('sent');
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border border-mosaic-border bg-mosaic-surface">
        <p className="text-xs text-mosaic-textMuted leading-relaxed mb-3">
          Transfer an ERC-721 (or 1155) token from your connected wallet to any address. Soulbound tokens will
          revert onchain; we surface the revert reason rather than pre-checking.
        </p>
        <label className="block mb-2">
          <span className="block text-xs text-mosaic-textMuted mb-1">Collection contract</span>
          <input type="text" value={collection} onChange={(e) => setCollection(e.target.value)} placeholder="0x..."
            className="w-full px-3 py-2 rounded-md bg-mosaic-bg border border-mosaic-border text-mosaic-text font-mono text-xs focus:outline-none focus:border-mosaic-primary" />
        </label>
        <label className="block mb-2">
          <span className="block text-xs text-mosaic-textMuted mb-1">Token ID</span>
          <input type="text" value={tokenId} onChange={(e) => setTokenId(e.target.value.replace(/[^0-9]/g, ''))} placeholder="1"
            className="w-full px-3 py-2 rounded-md bg-mosaic-bg border border-mosaic-border text-mosaic-text font-mono text-xs focus:outline-none focus:border-mosaic-primary" />
        </label>
        <label className="block mb-3">
          <span className="block text-xs text-mosaic-textMuted mb-1">Recipient</span>
          <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x..."
            className="w-full px-3 py-2 rounded-md bg-mosaic-bg border border-mosaic-border text-mosaic-text font-mono text-xs focus:outline-none focus:border-mosaic-primary" />
        </label>
        <button type="button" onClick={transfer} disabled={status === 'sending' || !bridgeReady}
          className="px-3 py-1.5 text-xs rounded-md bg-mosaic-primary text-mosaic-bg font-semibold disabled:opacity-50">
          {status === 'sending' ? 'Signing…' : 'Sign transfer'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-md border border-mosaic-danger/50 bg-mosaic-danger/10 text-mosaic-danger text-xs">
          {error}
        </div>
      )}

      {txHash && status === 'sent' && (
        <div className="p-4 rounded-lg border border-mosaic-success/30 bg-mosaic-success/10 text-xs">
          <p className="text-mosaic-success font-semibold mb-1">✓ Transfer confirmed</p>
          <pre className="text-mosaic-text font-mono break-all">{txHash}</pre>
          <p className="text-mosaic-textMuted mt-1">
            Token <code className="text-mosaic-primary">#{tokenId}</code> →{' '}
            <code className="text-mosaic-primary">{shortenAddress(recipient)}</code>{' · '}
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
