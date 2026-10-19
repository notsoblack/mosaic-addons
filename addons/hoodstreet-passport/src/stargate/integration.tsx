/**
 * Stargate integration — CCFF00 graph node component
 *
 * A reusable React SVG component that any Stargate graph can embed to
 * represent a CCFF00 NFT in its constellation. Clicking the node deep-links
 * into this addon at the right tokenId.
 *
 * Usage from a Stargate graph:
 *
 *   import { Ccff00Node } from 'hoodstreet-passport/stargate/graphNodes';
 *   <Ccff00Node tokenId="7980" onSelect={(id) => openAddon('hoodstreet-passport', { tokenId: id })} />
 *
 * If you need a non-React version, see the `staticNode` factory.
 */

import type { CSSProperties, MouseEvent } from 'react';

export interface Ccff00NodeProps {
  tokenId: string;
  size?: number;
  selected?: boolean;
  dimmed?: boolean;
  onSelect?: (tokenId: string) => void;
  style?: CSSProperties;
  /** Optional pre-fetched balance (raw string) to render inside the badge */
  ccff00BalanceRaw?: string;
}

const CCFF00_BRAND = '#CCFF00';

export function Ccff00Node({ tokenId, size = 56, selected, dimmed, onSelect, style, ccff00BalanceRaw }: Ccff00NodeProps) {
  const opacity = dimmed ? 0.15 : 1;
  const handleClick = (e: MouseEvent<SVGGElement>) => {
    e.stopPropagation();
    onSelect?.(tokenId);
  };
  return (
    <g
      role="button"
      aria-label={`CCFF00 #${tokenId}`}
      onClick={handleClick}
      style={{ cursor: 'pointer', opacity, transition: 'opacity 200ms', ...style }}
    >
      {/* Outer halo when selected */}
      {selected && (
        <circle cx={size / 2} cy={size / 2} r={size / 2 + 6} fill="none" stroke={CCFF00_BRAND} strokeWidth={2} opacity={0.6} />
      )}
      {/* Filled disc in the brand color */}
      <circle cx={size / 2} cy={size / 2} r={size / 2 - 2} fill={CCFF00_BRAND} stroke="#0a0a0f" strokeWidth={2} />
      {/* Token id label */}
      <text
        x={size / 2}
        y={size / 2 + 4}
        textAnchor="middle"
        fontSize={size * 0.28}
        fontWeight={700}
        fill="#0a0a0f"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        #{tokenId}
      </text>
      {/* Optional CCFF00 balance label below */}
      {ccff00BalanceRaw && (
        <text
          x={size / 2}
          y={size + 14}
          textAnchor="middle"
          fontSize={10}
          fill={CCFF00_BRAND}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {formatBadge(ccff00BalanceRaw)} CCFF00
        </text>
      )}
    </g>
  );
}

function formatBadge(raw: string): string {
  try {
    const n = BigInt(raw);
    const whole = n / 10n ** 18n;
    if (whole >= 1000n) return `${(Number(whole) / 1000).toFixed(1)}k`;
    return whole.toString();
  } catch {
    return '?';
  }
}

/**
 * Stargate loop templates — JSON for the Loop Builder "import preset" flow.
 *
 * These are exported as constants so a Stargate-side importer can show them
 * in the preset dropdown. Each template calls HoodStreet MCP tools through
 * the `mcp-call` node type and writes results to the addon's local data dir.
 */

export interface StargateLoopTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  /** Which addon this loop is owned by — used by the Loop Builder for grouping. */
  ownerAddon: string;
  nodes: Array<{
    id: string;
    type: 'mcp-call';
    label: string;
    config: {
      serverId: 'hoodstreet';
      toolName: string;
      args: Record<string, unknown>;
      argMapping?: Record<string, string>;
      timeoutMs?: number;
    };
  }>;
}

export const HOODSTREET_LOOP_TEMPLATES: StargateLoopTemplate[] = [
  {
    id: 'hoodstreet-member-audit',
    name: 'HoodStreet Member Audit',
    description:
      'Single-node: given a tokenId, call get_neon_assets on the HoodStreet MCP and persist the result to the addon data dir. Read-only, no signing.',
    version: '0.1.0',
    ownerAddon: 'hoodstreet-passport',
    nodes: [
      {
        id: 'audit',
        type: 'mcp-call',
        label: 'Audit CCFF00 token',
        config: {
          serverId: 'hoodstreet',
          toolName: 'get_neon_assets',
          args: { walletType: 'ccff00-erc6551' },
          argMapping: { tokenId: '{{input.tokenId}}' },
          timeoutMs: 15000,
        },
      },
    ],
  },
  {
    id: 'hoodstreet-mint-watch',
    name: 'HoodStreet Mint Watch',
    description:
      'Single-node: poll list_nft_mint_profiles every 6h, diff vs last run, and surface new entries. Run on a schedule.',
    version: '0.1.0',
    ownerAddon: 'hoodstreet-passport',
    nodes: [
      {
        id: 'list-profiles',
        type: 'mcp-call',
        label: 'List HoodStreet-curated mint profiles',
        config: {
          serverId: 'hoodstreet',
          toolName: 'list_nft_mint_profiles',
          args: {},
          timeoutMs: 15000,
        },
      },
    ],
  },
];
