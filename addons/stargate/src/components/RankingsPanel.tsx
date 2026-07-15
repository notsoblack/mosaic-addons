// =============================================================================
// RANKINGS PANEL
//
// Adapted from mosaic-companion's renderLeaderboard() inside AdaPortalPanel.tsx
// (origin/stargate-module @ 84c36c4, lines ~2277-2449) for the addon sandbox.
//
// The original had three sub-tabs backed by three different data sources:
//   - Agents: `hyperInsight.getUnifiedLeaderboard()` — a Mosaic-core service
//     that blends internal agent roster data (via window.electronAPI) with
//     node/AIM stats. Not reachable from an addon. Replaced with a ranking
//     built from `stargateRegistry.getAgents()` (self-contained, localStorage
//     registry already ported for the Train Agents / Bundles tabs), sorted by
//     rating then tasksCompleted.
//   - Skills: `skillMarketplace.getSkills()` sorted by installs — unchanged,
//     the ported SkillMarketplaceService is self-contained.
//   - AIMs: `hyperInsight.getTopAIMs(10)`, another Mosaic-core/electronAPI
//     call. Replaced with a direct unauthenticated fetch to HyperInsight's
//     own public leaderboard endpoint, per decision 4 (HyperInsight data must
//     be fetched directly from HyperInsight's public API by any addon that
//     needs it, never through Mosaic/addonAPI).
// =============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { Bot, Loader } from "lucide-react";
import { skillMarketplace } from "../services/SkillMarketplaceService";
import { stargateRegistry } from "../services/StargateSkillRegistry";
import type { AIMInfo } from "../services/types";

const HYPERINSIGHT_LEADERBOARD_URL = "https://api.hyperinsight.app/v1/aims/leaderboard?includeTrend=true";

type RankingTab = "agents" | "skills" | "aims";

export const RankingsPanel: React.FC = () => {
  const [rankingTab, setRankingTab] = useState<RankingTab>("agents");
  const [topAims, setTopAims] = useState<AIMInfo[]>([]);
  const [aimsLoading, setAimsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setAimsLoading(true);
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const resp = await fetch(HYPERINSIGHT_LEADERBOARD_URL, { signal: ctrl.signal });
        clearTimeout(t);
        if (!resp.ok) throw new Error(String(resp.status));
        const data = await resp.json().catch(() => null);
        const list: AIMInfo[] = Array.isArray(data) ? data : Array.isArray(data?.leaderboard) ? data.leaderboard : [];
        if (!cancelled) setTopAims(list.slice(0, 10));
      } catch {
        if (!cancelled) setTopAims([]);
      } finally {
        if (!cancelled) setAimsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const skillStats = skillMarketplace.getStats();
  const topSkills = useMemo(
    () =>
      skillMarketplace
        .getSkills()
        .slice()
        .sort((a, b) => (b.installs || 0) - (a.installs || 0))
        .slice(0, 10),
    [],
  );

  const topAgents = useMemo(
    () =>
      stargateRegistry
        .getAgents()
        .slice()
        .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.tasksCompleted || 0) - (a.tasksCompleted || 0))
        .slice(0, 10),
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Rankings</h3>
          <p className="text-sm text-gray-400 mt-0.5">
            See top-performing agents, skills, and AI models across the network.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRankingTab("agents")}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              rankingTab === "agents" ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-400"
            }`}
          >
            Agents
          </button>
          <button
            onClick={() => setRankingTab("skills")}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              rankingTab === "skills" ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400"
            }`}
          >
            Skills
          </button>
          <button
            onClick={() => setRankingTab("aims")}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              rankingTab === "aims" ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400"
            }`}
          >
            AIMs
          </button>
        </div>
      </div>

      {rankingTab === "agents" && (
        <div className="space-y-2">
          <p className="text-sm text-gray-400 mb-3">Ranked by rating, then tasks completed.</p>
          {topAgents.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-800 rounded-xl">
              <Bot size={32} className="mx-auto text-gray-700 mb-2" />
              <p className="text-gray-500 text-sm">No agents in your local registry yet.</p>
            </div>
          ) : (
            topAgents.map((agent, index) => (
              <div key={agent.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    index === 0
                      ? "bg-yellow-500/20 text-yellow-400"
                      : index === 1
                        ? "bg-gray-400/20 text-gray-300"
                        : index === 2
                          ? "bg-amber-600/20 text-amber-500"
                          : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-white">{agent.name}</div>
                  <div className="text-xs text-gray-500">
                    {agent.role} &middot; {agent.tasksCompleted} tasks &middot; {agent.status}
                  </div>
                </div>
                <div className="text-xl font-bold text-cyan-400">{agent.rating.toFixed(1)}</div>
              </div>
            ))
          )}
        </div>
      )}

      {rankingTab === "skills" && (
        <div className="space-y-2">
          <p className="text-sm text-gray-400 mb-3">
            Top skills from skills.sh &middot; {skillStats.totalInstalls.toLocaleString()} total installs
          </p>
          {topSkills.map((skill, index) => (
            <div key={skill.name} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  index === 0
                    ? "bg-green-500/20 text-green-400"
                    : index === 1
                      ? "bg-green-400/20 text-green-300"
                      : index === 2
                        ? "bg-green-600/20 text-green-500"
                        : "bg-gray-700 text-gray-400"
                }`}
              >
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium text-white">{skill.name}</div>
                <div className="text-xs text-gray-500">
                  {skill.category} &middot; {skill.provider}
                </div>
              </div>
              <div className="text-lg font-bold text-green-400">⚡ {skill.installs?.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {rankingTab === "aims" && (
        <div className="space-y-2">
          <p className="text-sm text-gray-400 mb-3">Top AI Models from api.hyperinsight.app</p>
          {aimsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader size={20} className="animate-spin text-gray-500" />
              <span className="text-sm text-gray-500 ml-2">Loading rankings...</span>
            </div>
          ) : topAims.length === 0 ? (
            <div className="text-center py-8">
              <Bot size={48} className="mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400">No AIM data available</p>
              <p className="text-xs text-gray-600 mt-1">
                Could not reach api.hyperinsight.app, or no rankings are currently published.
              </p>
            </div>
          ) : (
            topAims.map((aim, index) => (
              <div key={aim.name} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    index === 0
                      ? "bg-purple-500/20 text-purple-400"
                      : index === 1
                        ? "bg-purple-400/20 text-purple-300"
                        : index === 2
                          ? "bg-purple-600/20 text-purple-500"
                          : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-white">{aim.name}</div>
                  <div className="text-xs text-gray-500">
                    {aim.description?.slice(0, 50) || "AI Model"} &middot; Rank: {aim.rank}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-purple-400">{aim.computeTFLOPS || "?"} TFLOPS</div>
                  <div className="text-xs text-gray-500">{aim.activeNodes || 0} nodes</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default RankingsPanel;
