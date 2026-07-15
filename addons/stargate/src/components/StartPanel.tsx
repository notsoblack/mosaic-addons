// =============================================================================
// START PANEL
//
// Adapted from mosaic-companion's renderStart() inside AdaPortalPanel.tsx
// (origin/stargate-module @ 84c36c4, lines ~1049-2153).
//
// The original renderStart() is ~1,100 lines and is heavily entangled with
// Cardano/Tokeo NFT wallet connection, ANFE deployment, HyperCycle node
// factories, and battery-org pool state — none of which belong to this
// addon's 7 kept tabs (they back Hire Agents / Compute & Nodes / Stargate
// Pool / Deploy System, all explicitly dropped per §10 Phase 6 scope).
//
// Rather than risk surgery on that monolith to extract a page that dead-ends
// into dropped tabs, this is a clean rewrite of just the parts that are
// genuinely in scope: the intent-selection grid (trimmed to the 6 tabs this
// addon actually has — see INTENT_OPTIONS below, sourced from the original's
// INTENT_OPTIONS constant at AdaPortalPanel.tsx:105) and a small stat strip
// built from already-ported, self-contained services.
// =============================================================================

import React from "react";
import { Bot, Trophy, GraduationCap, Package, Zap, LayoutDashboard } from "lucide-react";
import { skillMarketplace } from "../services/SkillMarketplaceService";
import { stargateRegistry } from "../services/StargateSkillRegistry";
import type { TabId } from "../App";

interface IntentOption {
  id: TabId;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

const INTENT_OPTIONS: IntentOption[] = [
  {
    id: "aims",
    label: "AI Models",
    description: "Explore AI models (AIMs) — track HyperCycle, local, and community AIMs",
    icon: <Bot size={24} />,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    id: "rankings",
    label: "Rankings",
    description: "See top-performing agents, skills, and AI models across the network",
    icon: <Trophy size={24} />,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  {
    id: "training",
    label: "Train Agents",
    description: "Train your agents with custom skills and data",
    icon: <GraduationCap size={24} />,
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    id: "bundles",
    label: "Bundles",
    description: "Pre-packaged agent teams with skills — ready to deploy",
    icon: <Package size={24} />,
    color: "text-orange-400",
    bg: "bg-orange-400/10",
  },
  {
    id: "skills",
    label: "Skills Marketplace",
    description: "Discover and install skills for your agents",
    icon: <Zap size={24} />,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Overview of your AI Models, skills, bundles, and training activity",
    icon: <LayoutDashboard size={24} />,
    color: "text-indigo-400",
    bg: "bg-indigo-400/10",
  },
];

interface StartPanelProps {
  onNavigate: (tab: TabId) => void;
}

export const StartPanel: React.FC<StartPanelProps> = ({ onNavigate }) => {
  const skillStats = skillMarketplace.getStats();
  const bundleCount = stargateRegistry.getBundles().length;
  const agentCount = stargateRegistry.getAgents().length;

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">What do you want to do?</h2>
        <p className="text-gray-400">Pick a module to get started with Stargate.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {INTENT_OPTIONS.map((intent) => (
          <button
            key={intent.id}
            onClick={() => onNavigate(intent.id)}
            className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 hover:border-gray-700 text-left transition-all"
          >
            <div className="flex items-start gap-3">
              <div className={`w-12 h-12 rounded-lg ${intent.bg} flex items-center justify-center shrink-0`}>
                <span className={intent.color}>{intent.icon}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white">{intent.label}</h3>
                <p className="text-sm text-gray-400 mt-1">{intent.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-800">
        <div className="text-center p-3 rounded-lg bg-gray-900/30">
          <div className="text-xl font-bold text-purple-400">{agentCount}</div>
          <div className="text-xs text-gray-500">Agents in registry</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-gray-900/30">
          <div className="text-xl font-bold text-green-400">{skillStats.totalSkills}</div>
          <div className="text-xs text-gray-500">Skills</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-gray-900/30">
          <div className="text-xl font-bold text-orange-400">{bundleCount}</div>
          <div className="text-xs text-gray-500">Bundles</div>
        </div>
      </div>
    </div>
  );
};

export default StartPanel;
