/**
 * HoodStreet Passport — usePassport hook
 *
 * Drives the Passport view state machine: idle → loading → ready | error.
 * Pure read-only — never asks for a signer, never broadcasts.
 */

import { useCallback, useEffect, useState } from 'react';
import type { AddonAPI } from '../types/addonApi';
import { callHoodstreetTool, resolveMcp, type McpMode } from '../lib/mcp';

export interface PassportWallet {
  tokenId: string;
  owner: string;
  canonicalTba: string;
  deployed: boolean;
  activationRequired: boolean;
  controller: string;
}

export interface PassportBalances {
  native: { symbol: string; raw: string; decimals: number };
  balances: Array<{ symbol: string; address: string; decimals: number; raw: string }>;
  tradingEnabled: boolean;
  locked: boolean;
}

export interface PassportActivity {
  items: unknown[];
  hasMore: boolean;
}

export type PassportStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PassportState {
  status: PassportStatus;
  error?: string;
  wallet?: PassportWallet;
  balances?: PassportBalances;
  activity?: PassportActivity;
  mode: McpMode;
  modeReason: string;
}

export function usePassport(api: AddonAPI | undefined, tokenId: string | null) {
  const [state, setState] = useState<PassportState>({ status: 'idle', mode: 'demo', modeReason: 'initializing' });

  const run = useCallback(async () => {
    if (!tokenId || !/^[1-9]\d*$/.test(tokenId)) {
      setState({ status: 'idle', mode: 'demo', modeReason: 'enter a tokenId' });
      return;
    }
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const resolution = await resolveMcp(api);
      const [walletRes, assetsRes, activityRes] = await Promise.all([
        callHoodstreetTool(api, resolution, 'get_neon_wallet', { tokenId, walletType: 'ccff00-erc6551' }),
        callHoodstreetTool(api, resolution, 'get_neon_assets', { tokenId, walletType: 'ccff00-erc6551' }),
        callHoodstreetTool(api, resolution, 'get_neon_activity', { tokenId, walletType: 'ccff00-erc6551' }),
      ]);
      const wallet = parseWallet(walletRes, tokenId);
      const balances = parseAssets(assetsRes);
      const activity = parseActivity(activityRes);
      setState({ status: 'ready', mode: resolution.mode, modeReason: resolution.reason, wallet, balances, activity });
    } catch (err) {
      setState({ status: 'error', mode: 'demo', modeReason: 'unavailable', error: (err as Error).message });
    }
  }, [api, tokenId]);

  useEffect(() => {
    run();
  }, [run]);

  return { state, reload: run };
}

function textOf(r: { content?: Array<{ type: string; text: string }> } | undefined): string {
  if (!r || !r.content) return '';
  return r.content.map((c) => c.text).join('');
}

function parseWallet(r: unknown, tokenId: string): PassportWallet {
  const obj = JSON.parse(textOf(r as { content?: Array<{ type: string; text: string }> }));
  return {
    tokenId,
    owner: obj.owner,
    canonicalTba: obj.canonicalTba ?? obj.walletAddress,
    deployed: obj.deployed ?? obj.wallet?.deployed ?? true,
    activationRequired: obj.activationRequired ?? obj.wallet?.activationRequired ?? false,
    controller: obj.controller ?? obj.wallet?.controller ?? obj.owner,
  };
}

function parseAssets(r: unknown): PassportBalances {
  const obj = JSON.parse(textOf(r as { content?: Array<{ type: string; text: string }> }));
  return {
    native: obj.native ?? { symbol: 'ETH', raw: '0', decimals: 18 },
    balances: obj.balances ?? [],
    tradingEnabled: obj.ccff00?.tradingEnabled ?? false,
    locked: obj.ccff00?.locked ?? true,
  };
}

function parseActivity(r: unknown): PassportActivity {
  try {
    const obj = JSON.parse(textOf(r as { content?: Array<{ type: string; text: string }> }));
    return { items: obj.items ?? [], hasMore: !!obj.hasMore };
  } catch {
    return { items: [], hasMore: false };
  }
}
