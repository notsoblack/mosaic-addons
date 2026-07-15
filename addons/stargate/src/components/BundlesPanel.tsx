// =============================================================================
// BUNDLES PANEL
//
// Adapted from mosaic-companion's renderPackages() inside AdaPortalPanel.tsx
// (origin/stargate-module @ 84c36c4, lines ~2524-2583).
//
// Data source: `stargateRegistry.getBundles()` (self-contained,
// localStorage-backed, already ported for this addon). Same "My AI Agents"
// simplification as TrainAgentsPanel: the original's shared AgentSelectModal
// (electronAPI.aiAgents-backed) is replaced with an inline picker built on
// `addonAPI.agents.list()`.
// =============================================================================

import React, { useEffect, useState } from "react";
import { Bot, Package, X } from "lucide-react";
import { toast } from "react-toastify";
import { stargateRegistry } from "../services/StargateSkillRegistry";
import type { BundleConfig } from "../services/StargateSkillRegistry";

interface AgentSummary {
  id: string;
  name: string;
  provider?: unknown;
  model?: unknown;
  isActive?: unknown;
}

export const BundlesPanel: React.FC = () => {
  const [packages, setPackages] = useState<BundleConfig[]>([]);
  const [myAgents, setMyAgents] = useState<AgentSummary[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<BundleConfig | null>(null);

  useEffect(() => {
    setPackages(stargateRegistry.getBundles());
  }, []);

  const openPicker = async (pkg: BundleConfig) => {
    setPickerTarget(pkg);
    setPickerOpen(true);
    setAgentsLoading(true);
    try {
      const agents = await window.addonAPI.agents.list();
      setMyAgents(agents);
    } catch (e) {
      const err = window.addonAPI.parseError(e);
      toast.error(`Could not load your agents: ${err.message}`);
      setMyAgents([]);
    } finally {
      setAgentsLoading(false);
    }
  };

  const getPackage = (agent: AgentSummary) => {
    if (!pickerTarget) return;
    toast.success(`Applied "${pickerTarget.name}" bundle to ${agent.name}.`);
    setPickerOpen(false);
    setPickerTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Agent Bundles</h3>
          <p className="text-sm text-gray-400 mt-0.5">Pre-packaged agent teams with skills &mdash; ready to deploy.</p>
        </div>
        <span className="text-sm text-gray-400">{packages.length} packages</span>
      </div>

      {packages.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-800 rounded-xl">
          <Package size={32} className="mx-auto text-gray-700 mb-2" />
          <p className="text-gray-500 text-sm">No bundles in your registry yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-gray-800/50 rounded-lg p-4 border ${pkg.popular ? "border-green-500/50" : "border-gray-700"}`}
            >
              {pkg.popular && (
                <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Popular</span>
              )}
              <h4 className="font-semibold text-white mt-2">{pkg.name}</h4>
              <p className="text-sm text-gray-400 mt-1">{pkg.description}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {pkg.agents.map((agent, idx) => (
                  <span key={idx} className="text-xs px-2 py-0.5 bg-gray-700 rounded-full text-gray-300">
                    {agent.role}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3">
                <div>
                  <div className="text-xl font-bold text-green-400">${pkg.price}</div>
                </div>
                <button
                  onClick={() => openPicker(pkg)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Package size={16} />
                  Get Package
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Select an Agent</h3>
              <button
                onClick={() => setPickerOpen(false)}
                className="p-1 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            {agentsLoading ? (
              <p className="text-sm text-gray-400">Loading your agents...</p>
            ) : myAgents.length === 0 ? (
              <p className="text-sm text-gray-400">No agents found. Add an agent in Mosaic first.</p>
            ) : (
              <div className="space-y-2">
                {myAgents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => getPackage(agent)}
                    className="w-full flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg text-left transition-colors"
                  >
                    <Bot size={18} className="text-purple-400" />
                    <span className="text-white text-sm">{agent.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BundlesPanel;
