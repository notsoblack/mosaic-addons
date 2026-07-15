// =============================================================================
// STARGATE ADDON — top-level shell
//
// Wires addonAPI.init() (identity/manifest/theme handshake — theme CSS vars
// are actually applied by electron/addon-preload.ts itself on init and on
// every subsequent theme:changed event, so nothing else is needed here for
// theming) and tab navigation across the 7 sub-tabs kept from the original
// 11-tab AdaPortalPanel per §10 Phase 6 scope: Start, AI Models, Rankings,
// Train Agents, Bundles, Skills Marketplace, Dashboard.
// =============================================================================

import React, { useEffect, useState } from "react";
import { Rocket, Bot, Trophy, GraduationCap, Package, Zap, LayoutDashboard } from "lucide-react";
import StartPanel from "./components/StartPanel";
import StargateCommunityAIMPanel from "./components/StargateCommunityAIMPanel";
import RankingsPanel from "./components/RankingsPanel";
import TrainAgentsPanel from "./components/TrainAgentsPanel";
import BundlesPanel from "./components/BundlesPanel";
import StargateSkillsMarketplacePanel from "./components/StargateSkillsMarketplacePanel";
import DashboardPanel from "./components/DashboardPanel";
import { initializeRegistry } from "./services/StargateSkillRegistry";

export type TabId = "start" | "aims" | "rankings" | "training" | "bundles" | "skills" | "dashboard";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "start", label: "Start", icon: <Rocket size={16} /> },
  { id: "aims", label: "AI Models", icon: <Bot size={16} /> },
  { id: "rankings", label: "Rankings", icon: <Trophy size={16} /> },
  { id: "training", label: "Train Agents", icon: <GraduationCap size={16} /> },
  { id: "bundles", label: "Bundles", icon: <Package size={16} /> },
  { id: "skills", label: "Skills", icon: <Zap size={16} /> },
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
];

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>("start");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await window.addonAPI.init();
      } catch {
        // Init failure isn't fatal — every panel below degrades gracefully
        // (empty states) when its own data sources are unreachable.
      }
      try {
        await initializeRegistry();
      } catch {
        /* StargateSkillRegistry seeds itself with defaults on failure */
      }
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background,#0a0a0f)] text-gray-400">
        Loading Stargate...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background,#0a0a0f)] text-white">
      <div className="border-b border-gray-800 px-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-cyan-400 text-cyan-400"
                  : "border-transparent text-gray-400 hover:text-white"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-6xl mx-auto">
        {activeTab === "start" && <StartPanel onNavigate={setActiveTab} />}
        {activeTab === "aims" && <StargateCommunityAIMPanel />}
        {activeTab === "rankings" && <RankingsPanel />}
        {activeTab === "training" && <TrainAgentsPanel />}
        {activeTab === "bundles" && <BundlesPanel />}
        {activeTab === "skills" && <StargateSkillsMarketplacePanel />}
        {activeTab === "dashboard" && <DashboardPanel />}
      </div>
    </div>
  );
};

export default App;
