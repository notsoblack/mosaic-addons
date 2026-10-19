# FUTURE.md — Roadmap for HoodStreet Passport v0.2+

This document is for reviewers (Dr. Robert, hempmillionaire) and the
maintainer. It tracks scope we deliberately left out of v0.1 so the
review surface stays small and shippable.

## v0.2 — Burn-to-mint sub-passports

**Concept.** Spend the 10,000 CCFF00 sitting in your TBA to mint a
sub-NFT (a "sub-passport") that lives *inside* your Neon. Each Neon
becomes a portable inventory of memberships, tickets, achievements,
even other HoodStreet collections.

**Why it matters.** Right now the 10,000 CCFF00 tokens in every TBA
are locked (`tradingEnabled: false`). They have value as future
entitlement, but not as utility today. Burn-to-mint gives them a
real function without requiring HoodStreet to enable transfers.

**Blockers (in order).**

1. **Contract change** — the CCFF00 token contract needs a
   `burnAndMint` function. This is a change the HoodStreet team
   controls. Outreach to hempmillionaire is in flight.
2. **Registered mint profile** — once the contract is updated, a
   third-party mint profile needs to be registered on the public
   HoodStreet MCP. This will require review and approval.
3. **Sub-collection contract** — a new ERC-721 (or ERC-1155) needs
   to be deployed, with the HoodStreet agent as the minter. The
   sub-collection owner is the parent Neon.

**What this addon will do when unblocked.**

- A new `Activate` sub-view replaces the placeholder. It shows the
  user's available CCFF00 in the TBA, the burn cost for a sub-passport,
  and a button that calls `prepare_ccff00_mint` on the HoodStreet MCP.
- The signed transaction is returned to the user (caller-signed) and
  signed in their own Robinhood wallet, not by this addon.
- The resulting sub-passport NFT appears in the Passport view under
  "Sub-collection inventory" via `get_wallet_nft`.

**Not in scope.**

- Auto-signing (this addon will never hold a signer key, ever).
- Off-chain marketplaces for sub-passports.
- A custom sub-collection contract — we will use HoodStreet's
  recommended deployment, not our own.

## v0.3+ — Future collection

The "HoodStreet Member CCFF00 Passport" collection is a separate
artifact (a future HoodStreet collection on Robinhood Chain), not
something this addon ships. If it ever ships, the passport would be
minted from a Neon using the same burn-to-mint flow above.

## v0.4+ — Multi-collection dashboards

Today, the Passport view shows one CCFF00 at a time. v0.4 will let
the user enter multiple tokenIds and see a portfolio view across all
their Neons. This is also the natural place to surface any
non-CCFF00 TBA contents (e.g. StonkBrokers TBAs once we add a
StonkBrokers adapter in the addon's MCP wrapper).

## What will *never* ship in this addon

- Wallet signing
- Server-side broadcast
- Key storage (any form)
- A standalone HoodStreet MCP server
- Minting of any kind that doesn't go through the official HoodStreet
  MCP `prepare_*` + caller-signed flow
