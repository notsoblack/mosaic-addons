# HoodStreet Passport

A MosAIc Companion addon for **read-only audit of CCFF00 (HoodStreet Neon) holdings**. All four sub-views are read-only; the addon never holds keys, never signs transactions, and never initiates outbound transfers. State-changing operations are out of scope for v0.3.0. **This addon never holds keys.**

## SECURITY STATUS (v0.3.0)

v0.3.0 is a **read-only release**. The four active sub-views issue only `tools/call` requests to the HoodStreet MCP via the MosAIc addon bridge, and direct view-calls to Robinhood Chain via the public JSON-RPC endpoint for ERC-721 enumeration. No state-changing transaction is signed or broadcast by this addon.

The `HoodStreetMemberPassport.sol` source remains in the repository as archived reference material. **It is not deployed, not used by any active sub-view, and has not been formally audited.** It is preserved for a future v0.4 if the HoodStreet team adds a non-custodial mint path.

## Sub-views (v0.3.0)

v0.3.0 ships **four** active sub-views. All are read-only or low-impact. Create, Mint, and Transfer were present in v0.2.x source and are **archived** (kept on disk for reference; not reachable from the UI).

### Active

- **Passport** — single-tokenId audit. Reads the TBA, balances, activity, mint lock state from the HoodStreet MCP. Displays CCFF00 owner, canonical TBA address, native + ERC-20 balances, transfer lock, and recent activity.
- **Discover** — `list_nft_mint_profiles` with diff against the last seen snapshot. Surfaces new mint profiles as they appear.
- **Inventory** — list NFTs in a wallet or TBA. Combines the HoodStreet MCP `discover_wallet_nfts` (for CCFF00 TBA contents) with direct viem reads (for any other ERC-721 contract). MCP indexer failures (e.g. Blockscout 403) are surfaced as a distinct error rather than reported as an empty inventory.
- **Activate** *(v0.3.0 placeholder)* — burn-to-mint sub-passport roadmap. No burn or mint action is exposed in v0.3.0.

### Archived (v0.2.x, not reachable in v0.3.0)

- **Create** — 4-step deploy flow for a new `HoodStreetMemberPassport` sub-collection. The compiled contract and bytecode artifact remain in `src/contracts/` for reference, but the v0.3.0 UI does not import or render this view.
- **Mint** — gated mint from any deployed sub-collection. **No verified working mint path exists in v0.3.0.** The HoodStreet MCP's `prepare_wallet_action` (verified 2026-10-11) accepts only `transfer | wrap | unwrap` actions — there is no `call` action for an arbitrary contract call. The deployed canonical TBA for CCFF00 #7980 is a 173-byte EIP-1167 minimal proxy whose implementation does not expose the standard ERC-6551 `executeCall(address,uint256,bytes)` selector (`0x6b61b6e8`) or an `execute(address,uint256,bytes,uint8)` variant (`0x5fd9ae2e`). Direct `eth_call` of either selector reverts. The HoodStreet team's GitHub repo exposes 11 tools per adapter; the live MCP exposes 33, so we cannot independently audit the implementation of the tools we cannot read.
- **Transfer** — send an ERC-721 to a recipient. Not reachable in v0.3.0.

The archived source files remain in the source tree under `src/components/` so a future v0.4 can re-enable them if the HoodStreet team adds a non-custodial mint path. See `CHANGELOG.md` for the full v0.2.x → v0.3.0 transition rationale.

## Modes

The addon resolves the MCP path at runtime, in priority order:

1. **addon-bridge** — `window.addonAPI.mcp.callTool('hoodstreet', ...)` is available. This is the production path inside MosAIc Companion.
2. **demo** — when addonAPI is missing entirely (Dr. Robert reviewing the source in a plain browser). The UI renders with demo fixtures and a visible warning banner.

(The v0.2.0 `direct-https` fallback was removed in v0.2.1 because Electron's webview blocks cross-origin `fetch()`; the addon-bridge and demo paths are the only supported modes.)

## Stargate integration

- `src/stargate/integration.tsx` exports:
  - `Ccff00Node` — a brand-colored SVG component for Stargate graphs.
  - `HOODSTREET_LOOP_TEMPLATES` — two preset loop templates (`hoodstreet-member-audit`, `hoodstreet-mint-watch`) for the Loop Builder "import preset" flow.
- The addon itself does not need Stargate to function. If Stargate is active, these exports become available to it; if not, the addon is inert.

## Permissions (per Dr. Robert's v1 vocabulary)

- `mcp:read` — list HoodStreet MCP tools
- `mcp:call` — invoke HoodStreet MCP tools
- `shell:open-external` — open Blockscout / HoodStreet My Neon links in the user's default browser

No `wallet:read`, no `wallet:sign`, no Vault access, no main process entry.

## Architecture

- Renderer-only (Dr. Robert Round 3, 2026-08-01).
- No build step secrets — the entire source is reviewable in this PR.
- TypeScript strict, React 18, Vite 5, viem 2.57.
- Standalone-runnable: `npm install && npm run dev` boots a Vite dev server on port 5180 with a demo fallback so Dr. Robert can review the UI without standing up HoodStreet.

## Development

```bash
cd addons/hoodstreet-passport
npm install
npm run dev            # standalone review at http://localhost:5180
npm run build          # produces renderer/
npm run build:contract # compiles HoodStreetMemberPassport.sol to bytecode.json
```

## Why no main entry?

Third-party addons (per Dr. Robert's main-entry-removal directive) must implement all logic renderer-side. HoodStreet Passport uses only the documented addonAPI subset: `mcp`, `settings`, `files`, `events`, `ui`.

## Upstream

Calls the [HoodStreet Agent MCP](https://github.com/hempmillionaire/erc-6551-agent) over the public readonly endpoint. No key, no signup, no credentials. The MCP itself runs in `AGENT_MODE=readonly` and rejects server-side execution.

## Brand notice

HoodStreet, CCFF00, My Neon, and related names are trademarks of HoodStreet. This addon is a community tool, not an official HoodStreet product. See `NOTICE`.
