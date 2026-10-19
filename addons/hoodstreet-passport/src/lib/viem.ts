/**
 * HoodStreet Passport v0.2 — viem client + chain configuration.
 *
 * Wraps viem's publicClient + walletClient for Robinhood Chain (chain ID 4663)
 * so the rest of the addon has a single import for chain operations.
 *
 * IMPORTANT: This addon is noncustodial. We never accept a private key
 * as an argument, never log it, never persist it. The wallet client is
 * constructed from `window.ethereum` (the user's Robinhood Wallet /
 * MetaMask) which the user controls.
 */

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  defineChain,
  type PublicClient,
  type WalletClient,
  type Address,
  type Hash,
} from 'viem';

// Robinhood Chain mainnet. Source: https://docs.robinhood.com/chain
export const ROBINHOOD_CHAIN = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.chain.robinhood.com'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' },
  },
});

// Known mainnet addresses (pinned in src/lib/contractTemplate.ts as well,
// duplicated here because the user has to enter them in the UI).
export const HOODSTREET_DEPLOYMENT = {
  // CCFF00 (HoodStreet Membership) NFT contract
  parentNft: '0x505A22Ffed8d37ebE580FfD98d2Cdb0021189146' as Address,
  // CCFF00 (HoodStreet Membership) ERC-20 token contract
  parentToken: '0x73CB777311Dc5e464C53Ddafb4496Fd87fE0eC97' as Address,
  // HoodStreet canonical ERC-6551 registry
  registry: '0x000000006551c19487814612e58FE06813775758' as Address,
  // HoodStreet canonical ERC-6551 account implementation
  accountImplementation: '0x03dA8C9df253a4401b08629a6F50E4c4E8e248cC' as Address,
} as const;

let _public: PublicClient | null = null;
export function publicClient(): PublicClient {
  if (!_public) {
    _public = createPublicClient({
      chain: ROBINHOOD_CHAIN,
      transport: http(),
    }) as PublicClient;
  }
  return _public;
}

let _wallet: WalletClient | null = null;
export async function walletClient(): Promise<WalletClient> {
  // window.ethereum is the Robinhood Wallet / MetaMask / etc. The user
  // controls the key; we just request signing when the user explicitly
  // approves an action.
  if (typeof window === 'undefined' || !(window as unknown as { ethereum?: unknown }).ethereum) {
    throw new Error('No browser wallet found. Install Robinhood Wallet or MetaMask.');
  }
  if (!_wallet) {
    _wallet = createWalletClient({
      chain: ROBINHOOD_CHAIN,
      transport: custom((window as unknown as { ethereum: never }).ethereum),
    });
  }
  return _wallet;
}

export async function connectedAddress(): Promise<Address | null> {
  try {
    const w = await walletClient();
    const accounts = await w.getAddresses();
    return accounts[0] ?? null;
  } catch {
    return null;
  }
}

export async function waitForReceipt(hash: Hash, confirmations = 2): Promise<unknown> {
  return publicClient().waitForTransactionReceipt({ hash, confirmations });
}

export { ROBINHOOD_CHAIN as CHAIN };
