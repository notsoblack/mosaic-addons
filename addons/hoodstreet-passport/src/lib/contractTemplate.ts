/**
 * HoodStreet Passport v0.2.1 — Solidity contract template + inline ABI.
 *
 * The contract source lives at src/contracts/HoodStreetMemberPassport.sol.
 * For the addon's purposes we embed the ABI as a constant so the
 * runtime can build deploy / mint calls without a separate file fetch.
 *
 * To compile + deploy from a dev machine, use the scripts/ helpers
 * (compile-contract.js, deploy-collection.js). The addon UI does not
 * compile contracts in the browser; it builds deploy calldata from
 * the embedded ABI + constructor args and hands it to the user's
 * wallet for signing.
 *
 * IMPORTANT: The parent contract (CCFF00) and the gating TBA are
 * pinned at construction time. If the parent CCFF00 is ever migrated
 * to a new contract, every sub-collection deployed against this
 * template would need redeployment with the new parent address.
 *
 * SECURITY NOTE: This contract uses established Solidity security
 * patterns (OZ ERC721 + Ownable, immutable gate params, 3-check gate,
 * explicit error types, batch size cap). It has NOT been formally
 * audited. Treat as release-candidate quality; do not deploy to
 * mainnet with real funds without your own review.
 */

import type { Address } from 'viem';
import { keccak256 } from 'viem';

/// Canonical HoodStreet deployment (mirrored from src/lib/viem.ts).
export const HOODSTREET_DEPLOYMENT = {
  parentNft: '0x505A22Ffed8d37ebE580FfD98d2Cdb0021189146' as Address,
  parentToken: '0x73CB777311Dc5e464C53Ddafb4496Fd87fE0eC97' as Address,
  registry: '0x000000006551c19487814612e58FE06813775758' as Address,
} as const;

/// Constructor ABI: (name, symbol, parentContract, expectedTBA, gatingTokenId, initialBaseURI)
export const HOODSTREET_MEMBER_PASSPORT_CONSTRUCTOR_ABI = [
  { type: 'string',  name: 'name_' },
  { type: 'string',  name: 'symbol_' },
  { type: 'address', name: 'parentContract' },
  { type: 'address', name: 'expectedTBA' },
  { type: 'uint256', name: 'gatingTokenId' },
  { type: 'string',  name: 'initialBaseURI' },
] as const;

/// Function ABI: mintTo, batchMintTo, gateState, tbaOwner, setBaseURI, etc.
export const HOODSTREET_MEMBER_PASSPORT_FUNCTIONS = [
  {
    type: 'function',
    name: 'mintTo',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'batchMintTo',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'quantity', type: 'uint256' },
    ],
    outputs: [{ name: 'firstId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'gateState',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'currentParentOwner', type: 'address' },
      { name: 'tbaOwner', type: 'address' },
      { name: 'expectedTBA', type: 'address' },
      { name: 'gatingTokenId', type: 'uint256' },
      { name: 'parentHeld', type: 'bool' },
      { name: 'tbaCallerRequired', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'tbaOwner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'setBaseURI',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newURI', type: 'string' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'baseURIValue',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'MAX_BATCH',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/// Full ABI suitable for `new viem.Contract(address, abi, provider)`.
export const HOODSTREET_MEMBER_PASSPORT_ABI = [
  ...HOODSTREET_MEMBER_PASSPORT_FUNCTIONS,
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'parent',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'parentTBA',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'parentTokenId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'tbaAccount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'nextTokenId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'BaseURIUpdated',
    inputs: [{ name: 'newURI', type: 'string', indexed: false }],
  },
  {
    type: 'event',
    name: 'MintExecuted',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'executor', type: 'address', indexed: true },
    ],
  },
] as const;

/// Custom error selectors — computed at module load.
function selectorOf(name: string, params: string[]): `0x${string}` {
  // keccak256("name(type1,type2,...)")[0:4]
  const sig = `${name}(${params.join(',')})`;
  return keccak256(toHex(sig)).slice(0, 10) as `0x${string}`;
}

export const ERRORS = {
  GateClosed: selectorOf('GateClosed', ['address', 'address']),
  CallerNotTBA: selectorOf('CallerNotTBA', ['address', 'address']),
  TBAOwnerMismatch: selectorOf('TBAOwnerMismatch', ['address', 'address']),
  ZeroAddress: selectorOf('ZeroAddress', []),
  QuantityZero: selectorOf('QuantityZero', []),
  QuantityTooLarge: selectorOf('QuantityTooLarge', ['uint256', 'uint256']),
} as const;

/// Event topic hashes for log filtering.
export const EVENTS = {
  Transfer: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  BaseURIUpdated: '0x' + keccak256(toHex('BaseURIUpdated(string)')).slice(2),
  MintExecuted: '0x' + keccak256(toHex('MintExecuted(uint256,address,address)')).slice(2),
} as const;

/// Maximum batch size (mirrors the contract constant; useful for UI).
export const MAX_BATCH = 50;

function toHex(s: string): `0x${string}` {
  // Encode ASCII string to 0x-prefixed hex (used to compute event topic hashes).
  return ('0x' + Array.from(s).map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')) as `0x${string}`;
}
