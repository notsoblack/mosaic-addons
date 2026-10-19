/**
 * HoodStreet Passport v0.2.1 — Contract deploy + simulation helpers.
 *
 * Builds the unsigned deploy transaction for a HoodStreetMemberPassport
 * sub-collection. The user signs it in their own wallet. We never
 * touch the private key.
 *
 * SECURITY: This module runs `publicClient.simulateContract` BEFORE
 * asking the user's wallet to sign, and rejects the request if the
 * connected wallet is on a chain other than 4663. Both are required
 * checks per the pre-mainnet review (see FUTURE.md and the
 * "5 checks before first real-chain test" memo).
 */

import {
  encodeDeployData,
  type Address,
  type Hash,
  type Hex,
  getContractAddress,
} from 'viem';
import { publicClient, walletClient, CHAIN } from './viem';
import { HOODSTREET_MEMBER_PASSPORT_ABI } from './contractTemplate';

export interface DeployArgs {
  name: string;
  symbol: string;
  parentContract: Address;
  expectedTBA: Address;
  gatingTokenId: bigint;
  initialBaseURI: string;
}

export interface CompiledContract {
  abi: readonly unknown[];
  bytecode: Hex;
}

/// Hard-coded Robinhood Chain ID. Used to reject sign requests on the
/// wrong network before broadcasting.
export const EXPECTED_CHAIN_ID = CHAIN.id;

export class ChainMismatchError extends Error {
  constructor(public got: number, public want: number) {
    super(`Wrong chain: got ${got}, expected ${want} (Robinhood Chain mainnet). Reject the wallet prompt and switch networks.`);
  }
}

export class SimulationRevertedError extends Error {
  constructor(public reason: string) {
    super(`Simulated deploy reverted: ${reason}. Do not sign.`);
  }
}

export function buildDeployData(args: DeployArgs, bytecode: Hex): Hex {
  return encodeDeployData({
    abi: HOODSTREET_MEMBER_PASSPORT_ABI as readonly unknown[],
    bytecode,
    args: [
      args.name,
      args.symbol,
      args.parentContract,
      args.expectedTBA,
      args.gatingTokenId,
      args.initialBaseURI,
    ],
  });
}

/**
 * Verify the connected wallet is on Robinhood Chain. Throws
 * ChainMismatchError if not. The wallet's chainId property is what
 * the user has selected in their UI; we don't trust chainId from
 * the RPC alone.
 */
export async function assertChain(): Promise<void> {
  const wallet = await walletClient();
  const chainId = await wallet.getChainId();
  if (chainId !== EXPECTED_CHAIN_ID) {
    throw new ChainMismatchError(chainId, EXPECTED_CHAIN_ID);
  }
}

/**
 * Simulate the deploy BEFORE asking the user to sign. If the
 * simulation reverts, surface the reason and do NOT proceed to sign.
 */
export async function simulateDeploy(args: DeployArgs, bytecode: Hex, from: Address): Promise<void> {
  await assertChain();
  const data = buildDeployData(args, bytecode);
  try {
    // viem's type for simulateContract with constructor-encoded data
    // requires casting the `to: null` + data combo. The runtime is happy.
    await (publicClient().simulateContract as unknown as (args: { data: Hex; account: Address }) => Promise<unknown>)({
      data,
      account: from,
    });
  } catch (err) {
    throw new SimulationRevertedError((err as Error).message);
  }
}

/**
 * Sign + broadcast the deploy. Caller must have called simulateDeploy
 * first; we re-check the chain here as a final guard.
 */
export async function signAndBroadcastDeploy(
  args: DeployArgs,
  bytecode: Hex
): Promise<{ hash: Hash; contractAddress: Address }> {
  const wallet = await walletClient();
  await assertChain();
  const [from] = await wallet.getAddresses();
  if (!from) throw new Error('No wallet address available');

  // Defensive: simulate again right before the user signs. This catches
  // any state change between the initial check and the sign moment.
  await simulateDeploy(args, bytecode, from);

  const hash = await wallet.deployContract({
    abi: HOODSTREET_MEMBER_PASSPORT_ABI as readonly unknown[],
    bytecode,
    args: [
      args.name,
      args.symbol,
      args.parentContract,
      args.expectedTBA,
      args.gatingTokenId,
      args.initialBaseURI,
    ],
    chain: CHAIN,
    account: from,
  });

  const publicC = publicClient();
  const receipt = await publicC.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error(`Deploy tx reverted onchain (status=${receipt.status}). txHash=${hash}`);
  }
  if (!receipt.contractAddress) {
    throw new Error('Deploy tx succeeded but contractAddress is null — chain issue?');
  }
  return { hash, contractAddress: receipt.contractAddress };
}

/**
 * Read the current gate state. The 6-tuple shape matches the new
 * contract: (currentParentOwner, tbaOwner, expectedTBA, gatingTokenId,
 * parentHeld, tbaCallerRequired).
 */
export interface GateState {
  currentParentOwner: Address;
  tbaOwner: Address;
  expectedTBA: Address;
  gatingTokenId: bigint;
  parentHeld: boolean;
  /// True when the connected EOA IS the parent NFT owner; this is the
  /// only state in which a direct mintTo() from the EOA can succeed.
  /// For TBA-based gating (the default), tbaCallerRequired is false
  /// but the actual call must come from the TBA itself.
  tbaCallerRequired: boolean;
}

export async function readGateState(contractAddress: Address): Promise<GateState> {
  await assertChain();
  const result = await publicClient().readContract({
    address: contractAddress,
    abi: HOODSTREET_MEMBER_PASSPORT_ABI as readonly unknown[],
    functionName: 'gateState',
  });
  const [currentParentOwner, tbaOwner, expectedTBA, gatingTokenId, parentHeld, tbaCallerRequired] = result as [
    Address, Address, Address, bigint, boolean, boolean
  ];
  return { currentParentOwner, tbaOwner, expectedTBA, gatingTokenId, parentHeld, tbaCallerRequired };
}

/**
 * Helper for the UI: derives the actionable guidance from a gate
 * state. Returns a human-readable string + a status enum.
 */
export function gateGuidance(state: GateState): {
  status: 'ready' | 'wrong-tba' | 'parent-transferred' | 'configuration-error';
  message: string;
} {
  if (!state.parentHeld) {
    return {
      status: 'parent-transferred',
      message: `Parent CCFF00 #${state.gatingTokenId} is no longer owned by the expected TBA. The gate is closed.`,
    };
  }
  if (state.tbaOwner.toLowerCase() !== state.expectedTBA.toLowerCase()) {
    return {
      status: 'configuration-error',
      message: `The TBA's controlling EOA does not match the expected TBA. The TBA owner is ${state.tbaOwner}, expected ${state.expectedTBA}.`,
    };
  }
  return {
    status: 'ready',
    message: 'Gate is open. Mint must be called by the TBA itself, not by a direct EOA.',
  };
}
