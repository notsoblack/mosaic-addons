# Changelog

## v0.3.0 — 2026-10-11 (scope reduction)

After a live-chain verification of the HoodStreet MCP, v0.3 ships a
**smaller surface** than v0.2. The goal is honesty: don't ship UI that
promises a feature the MCP cannot deliver.

### What changed

- **Cut `Create / Mint / Transfer` sub-views from the active build.** The
  live HoodStreet MCP (verified on 2026-10-11) does not expose an
  arbitrary-contract-call action. `prepare_wallet_action` only supports
  `transfer | wrap | unwrap`. `prepare_nft_mint` requires a registered
  mint profile, and `list_nft_mint_profiles` returns `[]`. The HoodStreet
  TBA is a 173-byte EIP-1167 minimal proxy that does not expose
  `executeCall` or `execute` — the user's EOA cannot forward a mint
  through the TBA. v0.2.x's `Mint via MCP` button would have failed on
  every call. v0.3 removes it.
- **Active sub-views in v0.3:** Passport, Discover, Inventory, Activate.
  All read-only or low-impact.
- **Inventory sub-view is honest about the current bug.**
  `discover_wallet_nfts` is failing on the live MCP with "Blockscout asset
  discovery unavailable (403)" as of 2026-10-11. The Inventory sub-view
  surfaces this so users aren't misled.
- **Build-time non-custodial guard** (`scripts/check-noncustodial.cjs`)
  remains in the build pipeline. The guard was confirmed working against
  the v0.2.x source.
- **`HoodStreetMemberPassport.sol` and its compiled bytecode artifact
  remain in the source tree** as a future-proofing artifact. If the
  HoodStreet team adds a `call` action to `prepare_wallet_action` or
  registers a mint profile, the contract + UI can be re-enabled by
  re-importing `CreateCollectionView`, `GatedMintView`, `TransferView`
  in `App.tsx` and bumping to v0.4.

### Known issues (verified against the live HoodStreet MCP, 2026-10-11)

1. **No `call` action in `prepare_wallet_action`.** Without this, no
   user-deployed sub-collection can be minted from this addon.
2. **No third-party mint profiles registered.** `list_nft_mint_profiles`
   returns `{"profiles": []}`. `prepare_nft_mint` will revert for any
   user-deployed sub-collection.
3. **`discover_wallet_nfts` returns 403 from Blockscout.** The Inventory
   sub-view cannot auto-discover NFTs in a TBA right now. Manual
   collection contracts + direct viem reads still work.
4. **HoodStreet TBA does not implement `executeCall` or `execute`.**
   Verified by `eth_call` on the deployed TBA bytecode. Any mint path
   that would route through the TBA itself (without the MCP) will
   revert.
5. **HoodStreet GitHub source is behind the live deployment.** The
   public `hempmillionaire/erc-6551-agent` repo exposes 11 tools per
   adapter. The live MCP exposes 33. We cannot read the source for
   `prepare_wallet_action`, `prepare_marketplace_*`, etc.

### What v0.2.x shipped and is now archived

- `src/contracts/HoodStreetMemberPassport.sol` — 234 lines, 3-check
  gated ERC-721, 8422 bytes compiled bytecode. **Not audited.**
- `src/lib/contractTemplate.ts` — full ABI + custom error selectors.
- `src/lib/contractDeploy.ts` — viem-based deploy + simulation +
  chain-id check.
- `src/components/CreateCollectionView.tsx` — 4-step deploy UI.
- `src/components/GatedMintView.tsx` — gated mint UI (broken on live
  MCP; see issue 1 above).
- `src/components/TransferView.tsx` — ERC-721 transfer UI.
- `src/contracts/HoodStreetMemberPassport.bytecode.json` — compiled
  artifact.

These files remain in the source tree. They are not imported by the
v0.3 App.tsx. To re-enable them, see the v0.3 code comment in
`src/App.tsx`.

## v0.2.2 — 2026-10-11 (security response)

Added the non-custodial build-time guard, the SECURITY.md file, and
verified the on-chain TBA behavior. Shipped but the gated-mint flow
was based on an API assumption (action='call' on prepare_wallet_action)
that turned out to be wrong. Superseded by v0.3.0 within the same day.

## v0.2.1 — 2026-10-11 (security fix)

Rewrote the HoodStreetMemberPassport contract with a 3-check gate
instead of the v0.2.0 single-check. Direct EOA mints revert with
`CallerNotTBA`. The TBA-owner mismatch and parent-NFT ownership
checks were added.

## v0.2.0 — 2026-10-11 (initial gated-sub-collection design)

Added the Create / Mint / Inventory / Transfer sub-views on top of
v0.1.0. Introduced the gated sub-collection contract pattern. **The
contract's single-check gate was vulnerable to EOA bypass** — fixed in
v0.2.1. **The Mint sub-view's action='call' API assumption was wrong**
— fixed in v0.3.0 by removing the tab.

## v0.1.0 — 2026-10-10 (initial)

Read-only audit + Discover. Tailwind 3.4 + MosAIc dark theme + 7-tab
nav. Validated manifest, typecheck, build all clean.
