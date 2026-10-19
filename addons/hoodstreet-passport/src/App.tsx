/**
 * HoodStreet Passport — App router
 *
 * Seven sub-views (v0.2):
 *   - passport  : read-only member audit
 *   - discover  : HoodStreet-curated mints
 *   - activate  : v0.2 burn-to-mint roadmap (placeholder)
 *   - create    : deploy a gated sub-collection contract
 *   - mint      : gated mint from a deployed sub-collection
 *   - inventory : list NFTs in a wallet / TBA
 *   - transfer  : send an NFT to a recipient
 *
 * Sub-view state lives in the URL hash so deep links work.
 * The addonAPI is injected asynchronously; we wait for it before declaring
 * "no bridge" to avoid the false-positive "demo" mode flash.
 */

import { useEffect, useState } from 'react';
import type { AddonAPI } from './types/addonApi';
import { PassportView } from './components/PassportView';
import { DiscoverView } from './components/DiscoverView';
import { ActivateView } from './components/ActivateView';
import { InventoryView } from './components/InventoryView';
import { ToolsView } from './components/ToolsView';
// v0.3: CreateCollectionView, GatedMintView, TransferView removed
// from the build because the live HoodStreet MCP (verified 2026-10-11)
// does not expose an arbitrary-contract-call action. The gated-mint
// flow depends on either:
//   (a) prepare_wallet_action gaining a 'call' action
//   (b) a third-party mint profile being registered for our sub-collections
//   (c) the user having a TBA-aware wallet that can sign through the
//       HoodStreet TBA's own (undocumented) execution path
// Until one of those is true, those tabs would render broken UI that
// promises a feature the MCP cannot deliver. They remain in the
// source tree as v0.2.x historical code; see CHANGELOG.md.
import { BridgeMissingBanner } from './components/BridgeMissingBanner';

type Tab = 'passport' | 'discover' | 'inventory' | 'activate' | 'tools';

interface Props {
  api: AddonAPI | undefined;
  initialTokenId?: string;
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'passport', label: 'Passport' },
  { key: 'discover', label: 'Discover' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'tools', label: 'Tools' },
  { key: 'activate', label: 'Activate' },
];

export function App({ api, initialTokenId }: Props) {
  const [tab, setTab] = useState<Tab>(parseHash());
  const [bridgeReady, setBridgeReady] = useState<boolean>(!!api);
  const [bridgeTimedOut, setBridgeTimedOut] = useState<boolean>(false);

  useEffect(() => {
    if (api) {
      setBridgeReady(true);
      return;
    }
    const start = Date.now();
    const interval = window.setInterval(() => {
      if (window.addonAPI) {
        setBridgeReady(true);
        window.clearInterval(interval);
        return;
      }
      if (Date.now() - start > 2000) {
        window.clearInterval(interval);
        setBridgeTimedOut(true);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [api]);

  useEffect(() => {
    function onHash() { setTab(parseHash()); }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function go(t: Tab) { window.location.hash = t; }

  return (
    <div className="min-h-screen bg-mosaic-bg text-mosaic-text font-sans">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-6 pb-4 border-b border-mosaic-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-hoodstreet flex items-center justify-center text-mosaic-bg font-bold text-lg">
                H
              </div>
              <div>
                <h1 className="text-xl font-semibold text-mosaic-text">HoodStreet Passport</h1>
                <p className="text-xs text-mosaic-textMuted mt-0.5">
                  Read-only audit of CCFF00 (HoodStreet Neon) holdings · No keys stored · No transactions signed
                </p>
              </div>
            </div>
            <span className="text-[10px] text-mosaic-muted font-mono">v0.3.0</span>
          </div>
        </header>

        <nav className="flex gap-1 mb-5 border-b border-mosaic-border overflow-x-auto">
          {TABS.map((t) => (
            <TabButton key={t.key} current={tab} value={t.key} onClick={go}>{t.label}</TabButton>
          ))}
        </nav>

        {bridgeTimedOut && !bridgeReady && <BridgeMissingBanner />}

        <main>
          {tab === 'passport' && <PassportView api={api} initialTokenId={initialTokenId} bridgeReady={bridgeReady} />}
          {tab === 'discover' && <DiscoverView api={api} bridgeReady={bridgeReady} />}
          {tab === 'inventory' && <InventoryView api={api} bridgeReady={bridgeReady} />}
          {tab === 'tools' && <ToolsView api={api} bridgeReady={bridgeReady} />}
          {tab === 'activate' && <ActivateView />}
        </main>

        <footer className="mt-10 pt-4 border-t border-mosaic-border text-[10px] text-mosaic-muted leading-relaxed">
          HoodStreet, CCFF00, My Neon are trademarks of HoodStreet. This addon is a community tool,
          not an official HoodStreet product. See NOTICE.
        </footer>
      </div>
    </div>
  );
}

function parseHash(): Tab {
  const h = window.location.hash.replace('#', '');
  const valid = TABS.map((t) => t.key);
  return (valid.find((k) => k === h) ?? 'passport') as Tab;
}

function TabButton({ current, value, onClick, children }: { current: Tab; value: Tab; onClick: (t: Tab) => void; children: React.ReactNode }) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
        active
          ? 'border-mosaic-primary text-mosaic-primary'
          : 'border-transparent text-mosaic-textMuted hover:text-mosaic-text'
      }`}
    >
      {children}
    </button>
  );
}
