# Security

## Non-custodial invariant

**HoodStreet Passport never holds, transmits, or logs user private keys, seed phrases, or any signing capability.** This is enforced at build time by `scripts/check-noncustodial.cjs` (run as part of `npm run build` and in CI). Any future PR that introduces a private-key argument, a key-shaped localStorage write, an ethers.Wallet constructor with a key, or a privateKey field in a network payload will fail the build.

### What "enforced" means here

The non-custodial guard is a **regression check**, not a security proof. It greps the source tree for a defined set of forbidden patterns (private-key literals, key-shaped localStorage writes, `ethers.Wallet` constructors with a key, `.pem`/`.key`/seed file writes, `privateKey` fields in network payloads, seed-phrase literals, mnemonic references). The guard will fail the build if a future PR adds any of these patterns in the standard shape it knows about. It is **not** a substitute for:

- code review of new files,
- watching for patterns the regex does not cover (e.g. `wallet.encrypt()`, `eth_signTypedData`, key storage under names other than "key" / "privateKey" / "mnemonic"),
- runtime isolation between the addon webview and any future main-process integration.

A future PR that uses an unrecognized key-handling pattern will pass the guard while still being custodial. Treat the guard as a useful tripwire, not a guarantee.

The v0.3.0 active sub-views (Passport, Discover, Inventory, Activate) make only read-only MCP `tools/call` requests through the MosAIc addon bridge, and ERC-721 `balanceOf` / `tokenOfOwnerByIndex` view-calls to the public Robinhood Chain JSON-RPC. No transaction is signed, broadcast, or simulated by the addon in v0.3.0.

The HoodStreet MCP's `agent-controlled` write mode (which would require `AGENT_OWNER_PRIVATE_KEY`) is **never** enabled in this addon. The addon uses `addon-bridge` mode, where the user (or MosAIc's MCP integration panel on the user's behalf) initiates any MCP call.

## Live verification of assumptions (2026-10-11)

Before publishing v0.3.0 we verified the following on Robinhood Chain mainnet and against the live HoodStreet MCP:

| Assumption | Verified | Notes |
|---|---|---|
| CCFF00 NFT contract is `0x505A22Ffed8d37ebE580FfD98d2Cdb0021189146` | ✓ on Blockscout | matches HoodStreet deployment table |
| HoodStreet TBA for #7980 is `0x55DC48c2017ecb576f5Ab247B01A69aA271C1351` | ✓ via `get_neon_wallet` MCP call | 173-byte EIP-1167 minimal proxy |
| TBA's `owner()` returns the parent EOA | ✓ `eth_call` returns `0x481F52391418F1435567a1D9f712074dCd913484` | matches |
| TBA exposes `executeCall(address,uint256,bytes)` | ✗ reverts | selector `0x6b61b6e8` is not in TBA bytecode |
| TBA exposes `execute(address,uint256,bytes,uint8)` | ✗ reverts | selector `0x5fd9ae2e` is not in TBA bytecode |
| `prepare_wallet_action` accepts an arbitrary `call` action | ✗ returns `Invalid 'action'.` | only `transfer | wrap | unwrap` accepted |
| `list_nft_mint_profiles` returns any mint profiles | ✗ returns `{"profiles": []}` | no third-party mints are registered |
| `discover_wallet_nfts` succeeds | ✗ returns `{"error": "Blockscout asset discovery unavailable (403)"}` | upstream Blockscout issue as of 2026-10-11 |

**Consequence:** there is **no verified working mint path** for a user-deployed `HoodStreetMemberPassport` sub-collection in v0.3.0. The user's EOA cannot forward a mint through the TBA (the TBA has no standard execute selector), the HoodStreet MCP has no `call` action for arbitrary contract calls, and no third-party mint profile is registered for any sub-collection. v0.3.0 ships as a read-only audit addon; gated minting will require a change from the HoodStreet team (see `docs/upstream-issue-draft.md` for the question we'd ask).

## Contract security status

`HoodStreetMemberPassport.sol` is preserved in `src/contracts/` as **archived reference source** for a future v0.4. In v0.3.0:

- ⚠ **Not deployed.** No instance of this contract exists on Robinhood Chain.
- ⚠ **Not used by any active sub-view.** The Create / Mint / Transfer views that referenced it are archived.
- ⚠ **Not formally audited.** Treat as un-audited reference source, not as production-ready code.

If v0.4 reactivates the gated-mint flow, this contract will need an independent security review before any deployment, and the deployment address + compiled bytecode should be re-verified against `src/contracts/HoodStreetMemberPassport.bytecode.json`.

### The 3-check gate

```solidity
function _enforceGate(address caller) internal view {
    if (caller != parentTBA) revert CallerNotTBA(caller, parentTBA);
    address currentTbaOwner = tbaAccount.owner();
    if (currentTbaOwner != parentTBA) revert TBAOwnerMismatch(currentTbaOwner, parentTBA);
    address currentOwner = parent.ownerOf(parentTokenId);
    if (currentOwner != parentTBA) revert GateClosed(currentOwner, parentTBA);
}
```

What each check protects against:

1. `caller == parentTBA` — only the TBA can mint, not any EOA
2. `tbaAccount.owner() == parentTBA` — the TBA must be controlled by the expected EOA (defends against a TBA owner change that the parent NFT's check wouldn't catch)
3. `parent.ownerOf(parentTokenId) == parentTBA` — the parent CCFF00 must still be in the TBA (defends against a parent transfer that closes the gate)

### Known limits of the v0.2.1 contract

- **Single parent tokenId per sub-collection.** To support many parents, deploy one of these per parent.
- **Owner is the deployer, not the parent holder.** `setBaseURI` is callable by the deployer; the parent holder controls the gate, not the metadata. This is by design — anyone can deploy a sub-collection and point it at any parent.
- **The `tbaAccount.owner()` check assumes the TBA's `owner()` is the controlling EOA.** On HoodStreet's deployment we verified this is true. If HoodStreet ever changes the implementation such that `owner()` returns something different (the parent NFT, a hook address, etc.), this check needs to follow.
- **No reentrancy guard on `_safeMint`.** OpenZeppelin's ERC721 v5 has a `_checkOnERC721Received` call inside `_safeMint` which performs an external call to the recipient. If the recipient is a contract that re-enters the sub-collection, the gate check would pass on the way in (msg.sender is still the TBA), but the second mint would still require the TBA — so this is benign. We document it for completeness.

## Pre-mainnet checklist (do not skip, when v0.4 reactivates minting)

The checklist below is the work the v0.3.0 release intentionally **does not do**, because v0.3.0 has no mint path. It is preserved here as the bar v0.4 will need to clear before any deployment of the archived contract or re-enablement of the archived views.

- [ ] Read the complete `HoodStreetMemberPassport.sol` source and the future `GatedMintView.tsx` / `CreateCollectionView.tsx` yourself.
- [ ] Confirm no private keys or seed phrases enter the addon (build runs `check-noncustodial.cjs`; manual review of new code).
- [ ] Verify every state-changing action requires caller-controlled signing and surfaces the unsigned call to the user's wallet.
- [ ] Test on Robinhood Chain testnet with a low-value wallet before considering mainnet.
- [ ] Confirm the deployed contract bytecode matches the compiled artifact (`HoodStreetMemberPassport.bytecode.json`).
- [ ] Run `node scripts/verify-bytecode.cjs` (TODO: write this — it should read the deployed bytecode via `eth_getCode` and compare to the compiled artifact).
- [ ] Confirm a verified non-custodial mint path exists in the live HoodStreet MCP (today: none).

## What we deliberately did NOT do

- We did **not** add a reentrancy guard — the gate check is stateless (view calls only), so reentrancy cannot change the outcome.
- We did **not** add a pause/unpause switch — that would give the owner authority to deny mints to a legitimate TBA, contradicting the "owner controls the metadata, not the gate" split.
- We did **not** add a fee-on-mint — all mints are free. The sub-collection is a public-good, gate-only primitive, not a revenue source.
- We did **not** add an allowlist — the gate is purely onchain, derived from parent ownership. No owner override.

## Reporting issues

If you find a security issue, please open a private issue at github.com/notsoblack/hoodstreet-passport and tag it `security`. Do not disclose publicly until we've had a chance to fix.
