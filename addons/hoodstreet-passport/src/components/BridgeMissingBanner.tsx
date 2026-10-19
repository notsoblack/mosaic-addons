/**
 * HoodStreet Passport — bridge-missing banner
 *
 * If `window.addonAPI` is not present after a 2s grace period (e.g. when the
 * source is opened in a plain browser for Dr. Robert to review the UI), the
 * addon shows this visible warning rather than silently fall back to demo data.
 */

export function BridgeMissingBanner() {
  return (
    <div className="mb-4 p-3 rounded-md border border-mosaic-warning/50 bg-mosaic-warning/10 text-mosaic-warning text-sm">
      <span className="font-semibold">addonAPI not detected.</span>{' '}
      You are viewing the addon's standalone build (for Dr. Robert review). Data shown is a demo fixture.
      To use real HoodStreet data, load the addon via Settings → Addons in MosAIc Companion.
    </div>
  );
}
