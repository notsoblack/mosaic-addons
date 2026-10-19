/**
 * HoodStreet Passport — Activate view (v0.3.0 placeholder)
 *
 * No actions are exposed in v0.3.0. This view is a roadmap note for
 * Dr. Robert's review, not a functional sub-view.
 *
 * Design proposal (NOT available in v0.3.0):
 *   - The CCFF00 token contract does not yet expose a burnAndMint
 *     function. This is a change the HoodStreet team controls.
 *   - A registered third-party mint profile must be reviewed and
 *     pinned by hempmillionaire.
 *   - A sub-collection contract needs to be deployed, with the parent
 *     HoodStreet agent as the minter.
 *   - v0.3.0 ships with no mint path, no burn path, and no
 *     burn-to-mint. The Activate sub-view is intentionally inert.
 */

export function ActivateView() {
  return (
    <div className="space-y-4">
      <div className="p-5 rounded-lg border border-hoodstreet/40 bg-hoodstreet/5">
        <h2 className="text-base font-semibold text-hoodstreet">Burn-to-mint sub-passports — design proposal, not available in v0.3.0</h2>
        <p className="text-sm text-mosaic-text mt-2 leading-relaxed">
          A possible future direction: spend the 10,000 CCFF00 sitting in your TBA to mint a sub-NFT
          that lives <em>inside</em> your Neon, so each CCFF00 becomes a portable inventory of
          memberships, tickets, and achievements.
        </p>
        <p className="text-xs text-mosaic-warning mt-3 leading-relaxed">
          <strong>No action is exposed in v0.3.0.</strong> No mint, no burn, no transfer. This is a
          design proposal only. It would require a change from the HoodStreet team (a
          <code className="font-mono"> burnAndMint</code> on the CCFF00 contract, a registered third-party
          mint profile, or a new MCP action type) before it could be implemented.
        </p>
      </div>

      <div className="p-5 rounded-lg border border-mosaic-border bg-mosaic-surface">
        <h3 className="text-sm font-semibold text-mosaic-text mb-3">Why this view is empty in v0.3.0</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-mosaic-textMuted leading-relaxed">
          <li>The CCFF00 token contract does not yet expose a <code className="font-mono text-mosaic-primary">burnAndMint</code> function. This is a change the HoodStreet team controls.</li>
          <li>A registered third-party mint profile must be reviewed and pinned by hempmillionaire.</li>
          <li>A sub-collection contract needs to be deployed, with the parent HoodStreet agent as the minter.</li>
          <li>The live HoodStreet MCP's <code className="font-mono text-mosaic-primary">prepare_wallet_action</code> (verified 2026-10-11) accepts only <code className="font-mono text-mosaic-primary">transfer | wrap | unwrap</code> — there is no <code className="font-mono text-mosaic-primary">call</code> action for an arbitrary contract call.</li>
        </ol>
        <p className="text-xs text-mosaic-muted mt-4">
          See <code className="font-mono">FUTURE.md</code> in this addon for the full design, and
          <code className="font-mono"> docs/upstream-issue-draft.md</code> for the question we'd ask
          the HoodStreet team.
        </p>
      </div>
    </div>
  );
}
