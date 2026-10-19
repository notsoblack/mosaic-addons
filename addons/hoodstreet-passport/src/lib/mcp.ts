/**
 * HoodStreet Passport — MCP wrapper
 *
 * Detects the live HoodStreet MCP through MosAIc's addon bridge.
 * Falls back to demo-mode only when truly outside MosAIc (e.g. for
 * Dr. Robert reviewing the source in a plain browser).
 *
 * NOTE: a `direct-https` fallback to https://agent.hoodstreet.capital/mcp
 * was considered, but Electron's webview blocks cross-origin fetch from
 * the addon webview by default. The MosAIc MCP integration panel is the
 * only supported way to call HoodStreet from inside an addon.
 */

import type { AddonAPI, McpCallResult, McpToolInfo } from '../types/addonApi';

const HOODSTREET_MCP_URL = 'https://agent.hoodstreet.capital/mcp';
const HOODSTREET_MCP_NAME = 'hoodstreet';

export type McpMode = 'addon-bridge' | 'not-configured' | 'demo';

export interface McpResolution {
  mode: McpMode;
  serverId?: string;
  reason: string;
}

/**
 * Resolve which MCP path to use. The addon is fully useful through the
 * addon bridge (preferred), but degrades gracefully if the user is reviewing
 * the source without the harness, or if HoodStreet isn't registered as a
 * MosAIc MCP.
 */
export async function resolveMcp(api: AddonAPI | undefined): Promise<McpResolution> {
  if (!api) {
    return { mode: 'demo', reason: 'addonAPI not present — running in demo mode (open via MosAIc Companion)' };
  }
  try {
    const servers = await api.mcp.listServers();
    const hood = servers.find((s) => s.id === HOODSTREET_MCP_NAME || s.name === HOODSTREET_MCP_NAME);
    if (hood) {
      return { mode: 'addon-bridge', serverId: hood.id, reason: 'HoodStreet MCP found via MosAIc addonAPI' };
    }
    return {
      mode: 'not-configured',
      reason: 'HoodStreet MCP not registered in MosAIc — open MCP Servers and add https://agent.hoodstreet.capital/mcp (HTTP transport)',
    };
  } catch (err) {
    return { mode: 'demo', reason: `addonAPI.mcp.listServers failed: ${(err as Error).message}` };
  }
}

/**
 * Call a HoodStreet MCP tool. Routes through the addon bridge when possible.
 * When the MCP isn't configured, returns a clear error message rather than
 * silently falling back to a fetch that Electron's webview will block.
 */
export async function callHoodstreetTool(
  api: AddonAPI | undefined,
  resolution: McpResolution,
  toolName: string,
  args: Record<string, unknown>,
): Promise<McpCallResult> {
  if (resolution.mode === 'addon-bridge' && api && resolution.serverId) {
    return api.mcp.callTool(resolution.serverId, toolName, args);
  }
  if (resolution.mode === 'not-configured') {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: 'HoodStreet MCP is not registered in MosAIc. Open MCP Servers → Add → Name "hoodstreet", URL https://agent.hoodstreet.capital/mcp, transport HTTP, then reload this addon.',
      }],
    };
  }
  return demoToolResponse(toolName, args);
}

/**
 * List HoodStreet MCP tools — used by the Discover view to surface what
 * is available without invoking anything.
 */
export async function listHoodstreetTools(api: AddonAPI | undefined, resolution: McpResolution): Promise<McpToolInfo[]> {
  if (resolution.mode === 'addon-bridge' && api && resolution.serverId) {
    const r = await api.mcp.listTools(resolution.serverId);
    return Array.isArray(r) ? r : (r.tools ?? []);
  }
  return KNOWN_HOODSTREET_TOOLS;
}

const KNOWN_HOODSTREET_TOOLS: McpToolInfo[] = [
  // ── read-only audit tools (8, fully wired into sub-views) ─────────────────
  { name: 'get_neon_wallet', description: 'Resolve and independently verify a CCFF00 NFT\'s canonical ERC-6551 wallet.', category: 'read', args: { tokenId: 'CCFF00 tokenId (e.g. 7980)', walletType: "'ccff00-erc6551'" } },
  { name: 'get_neon_assets', description: 'Read the Neon wallet\'s native and approved ERC-20 assets plus the live CCFF00 trading lock.', category: 'read', args: { tokenId: 'CCFF00 tokenId', walletType: "'ccff00-erc6551'" } },
  { name: 'get_neon_balances', description: 'Read raw balances for CCFF00 and approved Robinhood stock tokens.', category: 'read', args: { tokenId: 'CCFF00 tokenId', walletType: "'ccff00-erc6551'" } },
  { name: 'get_neon_activity', description: 'Read recent ERC-20 activity for the canonical Neon wallet through Blockscout.', category: 'read', args: { tokenId: 'CCFF00 tokenId', walletType: "'ccff00-erc6551'" } },
  { name: 'discover_wallet_nfts', description: 'Discover all ERC-721 and ERC-1155 NFTs held by a TBA (Blockscout-backed, returns 403 if the indexer is down).', category: 'read', args: { tokenId: 'CCFF00 tokenId', walletType: "'ccff00-erc6551'" } },
  { name: 'list_nft_mint_profiles', description: 'List explicitly reviewed third-party NFT mint profiles registered on this host.', category: 'read', args: {} },
  // ── additional read-only tools (not yet wired into a sub-view, callable via Tools view) ──
  { name: 'get_wallet_token', description: 'Read a single ERC-20 token balance for the canonical Neon wallet (raw units).', category: 'read', args: { tokenId: 'CCFF00 tokenId', tokenAddress: "'0x...'" } },
  { name: 'get_wallet_nft', description: 'Read a single ERC-721/ERC-1155 holding for the canonical Neon wallet.', category: 'read', args: { tokenId: 'CCFF00 tokenId', contractAddress: "'0x...'", assetTokenId: 'optional tokenId in the collection' } },
  { name: 'discover_wallet_tokens', description: 'Discover all ERC-20 tokens held by the canonical Neon wallet via Blockscout (indexer-backed, may return 503).', category: 'read', args: { tokenId: 'CCFF00 tokenId' } },
  // ── read-only trade helpers (referenced; the canonical "should I trade" preflight) ──
  { name: 'get_neon_trade_quote', description: 'Request a fully validated exact-input LI.FI/Fly quote. CCFF00 routes fail closed while trading is locked.', category: 'read', args: { tokenId: 'CCFF00 tokenId', fromToken: "'0x...'", toToken: "'0x...'", amount: 'base-units string' } },
  // ── status readbacks (no signing, callable via Tools view) ────────────────
  { name: 'get_wallet_action_status', description: 'Look up the status of a previously-prepared wallet action by its action id.', category: 'read', args: { actionId: "'0x...'" } },
  { name: 'get_neon_trade_status', description: 'Look up the status of a previously-prepared Neon trade by its trade id.', category: 'read', args: { tradeId: "'0x...'" } },
  { name: 'get_nft_mint_status', description: 'Look up the status of a previously-prepared NFT mint by its mint id.', category: 'read', args: { mintId: "'0x...'" } },
  { name: 'get_marketplace_action_status', description: 'Look up the status of a previously-prepared Seaport marketplace action by its id.', category: 'read', args: { actionId: "'0x...'" } },
  { name: 'get_ccff00_mint_status', description: 'Look up the status of a previously-prepared CCFF00 mint by its mint id.', category: 'read', args: { mintId: "'0x...'" } },
  // ── prepare_* (non-custodial, user signs in their own wallet) ─────────────
  { name: 'prepare_wallet_action', description: 'Prepare an unsigned wallet action (transfer, wrap, unwrap). User signs in their own wallet.', category: 'prepare', args: { tokenId: 'CCFF00 tokenId', walletType: "'ccff00-erc6551'", action: "'transfer' | 'wrap' | 'unwrap'", recipient: "'0x...'", amount: 'base-units string' } },
  { name: 'prepare_neon_trade', description: 'Prepare an unsigned Neon trade (CCFF00 ↔ ERC-20 via LI.FI/Fly). User signs.', category: 'prepare', args: { tokenId: 'CCFF00 tokenId', fromToken: "'0x...'", toToken: "'0x...'", amount: 'base-units string' } },
  { name: 'simulate_neon_trade', description: 'Simulate a Neon trade without producing a signature (dry run).', category: 'prepare', args: { tokenId: 'CCFF00 tokenId', fromToken: "'0x...'", toToken: "'0x...'", amount: 'base-units string' } },
  { name: 'execute_neon_trade', description: 'Execute a Neon trade using the server\'s signer (NOT non-custodial — operator-only).', category: 'execute', args: { tradeId: "'0x...'" } },
  { name: 'prepare_nft_mint', description: 'Prepare an unsigned NFT mint against a registered third-party mint profile. User signs.', category: 'prepare', args: { profileId: "'0x...'", quantity: 'integer ≥ 1' } },
  { name: 'simulate_nft_mint', description: 'Simulate an NFT mint without producing a signature (dry run).', category: 'prepare', args: { profileId: "'0x...'", quantity: 'integer ≥ 1' } },
  { name: 'confirm_nft_mint', description: 'Confirm a prepared NFT mint by submitting the user\'s signed payload.', category: 'prepare', args: { mintId: "'0x...'", signature: "'0x...'" } },
  // ── marketplace (Seaport) prepare/confirm ─────────────────────────────────
  { name: 'prepare_marketplace_approval', description: 'Prepare an unsigned Seaport ERC-721/ERC-1155 approval. User signs.', category: 'prepare', args: { tokenId: 'CCFF00 tokenId', contractAddress: "'0x...'", operator: "'0x...'", approved: 'boolean' } },
  { name: 'prepare_marketplace_cancellation', description: 'Prepare an unsigned Seaport order cancellation. User signs.', category: 'prepare', args: { tokenId: 'CCFF00 tokenId', orderHash: "'0x...'" } },
  { name: 'prepare_marketplace_order_signature', description: 'Prepare a Seaport order signature payload for the user to sign (EIP-712).', category: 'prepare', args: { tokenId: 'CCFF00 tokenId', maker: "'0x...'", side: "'list' | 'offer'", parameters: 'order parameters object' } },
  { name: 'prepare_marketplace_fulfillment', description: 'Prepare an unsigned Seaport order fulfillment. User signs.', category: 'prepare', args: { tokenId: 'CCFF00 tokenId', orderHash: "'0x...'" } },
  { name: 'confirm_marketplace_action', description: 'Confirm a prepared Seaport action by submitting the user\'s signed payload.', category: 'prepare', args: { actionId: "'0x...'", signature: "'0x...'" } },
  // ── CCFF00 mainnet mint flow (server-signed; operator-only) ──────────────
  { name: 'prepare_ccff00_mint', description: 'Prepare a CCFF00 mainnet mint transaction. Server signs (NOT non-custodial).', category: 'execute', args: { recipient: "'0x...'", quantity: 'integer ≥ 1' } },
  { name: 'simulate_ccff00_mint', description: 'Simulate a CCFF00 mainnet mint without producing a transaction.', category: 'execute', args: { recipient: "'0x...'", quantity: 'integer ≥ 1' } },
  { name: 'execute_ccff00_mint', description: 'Execute a CCFF00 mainnet mint using the server\'s signer (operator-only).', category: 'execute', args: { mintId: "'0x...'" } },
  { name: 'recover_ccff00_mint', description: 'Recover a stuck or partial CCFF00 mint (operator-only).', category: 'execute', args: { mintId: "'0x...'" } },
  // ── wallet-action confirm path (pairs with prepare_wallet_action) ──────────
  { name: 'confirm_wallet_action', description: 'Confirm a prepared wallet action by submitting the user\'s signed payload.', category: 'prepare', args: { actionId: "'0x...'", signature: "'0x...'" } },
  // ── confirm the unsigned Neon trade produced by prepare_neon_trade ────────
  { name: 'confirm_neon_trade', description: 'Confirm a prepared Neon trade by submitting the user\'s signed payload.', category: 'prepare', args: { tradeId: "'0x...'", signature: "'0x...'" } },
  // ── social: post a completed trade to X (Twitter) ─────────────────────────
  { name: 'post_neon_trade_to_x', description: 'Post a summary of a completed Neon trade to X (Twitter). Requires X OAuth — operator-only.', category: 'execute', args: { tradeId: "'0x...'" } },
];

/**
 * Demo response — only used when neither addonAPI nor MosAIc is available
 * (e.g. Dr. Robert reviewing the source in a plain browser). Shape mirrors
 * the real HoodStreet MCP responses so the parsers don't need to special-case.
 */
function demoToolResponse(toolName: string, args: Record<string, unknown>): McpCallResult {
  const tokenId = (args.tokenId as string) ?? '7980';

  if (toolName === 'get_neon_assets') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          wallet: {
            tokenId, owner: '0x481F52391418F1435567a1D9f712074dCd913484',
            canonicalTba: '0x55DC48c2017ecb576f5Ab247B01A69aA271C1351',
            deployed: true, activationRequired: false,
            controller: '0x481F52391418F1435567a1D9f712074dCd913484',
            walletType: 'ccff00-erc6551', walletAddress: '0x55DC48c2017ecb576f5Ab247B01A69aA271C1351',
          },
          native: { symbol: 'ETH', raw: '1713985533328095', decimals: 18 },
          balances: [
            { symbol: 'CCFF00', address: '0x73CB777311Dc5e464C53Ddafb4496Fd87fE0eC97', decimals: 18, raw: '10000000000000000000000' },
            { symbol: 'AAPL',   address: '0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9', decimals: 18, raw: '0' },
            { symbol: 'AMZN',   address: '0x12f190a9f9d7a250758b26824b97ce941bf54', decimals: 18, raw: '0' },
            { symbol: 'NVDA',   address: '0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC', decimals: 18, raw: '0' },
          ],
          ccff00: { address: '0x73CB777311Dc5e464C53Ddafb4496Fd87fE0eC97', tradingEnabled: false, locked: true },
        }, null, 2),
      }],
    };
  }

  if (toolName === 'get_neon_wallet') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          tokenId, owner: '0x481F52391418F1435567a1D9f712074dCd913484',
          canonicalTba: '0x55DC48c2017ecb576f5Ab247B01A69aA271C1351',
          deployed: true, activationRequired: false,
          controller: '0x481F52391418F1435567a1D9f712074dCd913484',
        }, null, 2),
      }],
    };
  }

  if (toolName === 'get_neon_activity') {
    return { content: [{ type: 'text', text: JSON.stringify({ items: [], hasMore: false }, null, 2) }] };
  }

  if (toolName === 'list_nft_mint_profiles') {
    return { content: [{ type: 'text', text: JSON.stringify([], null, 2) }] };
  }

  return { content: [{ type: 'text', text: JSON.stringify({ demo: true, tool: toolName }, null, 2) }] };
}

export { HOODSTREET_MCP_URL, HOODSTREET_MCP_NAME, KNOWN_HOODSTREET_TOOLS };
