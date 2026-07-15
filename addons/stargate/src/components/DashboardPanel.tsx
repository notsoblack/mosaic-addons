// =============================================================================
// DASHBOARD PANEL
//
// Adapted from mosaic-companion's renderDashboard() inside AdaPortalPanel.tsx
// (origin/stargate-module @ 84c36c4, lines ~2154-2203).
//
// Judgment call (documented per §10 Phase 6 instructions — flag anything
// dropped or stubbed differently than planned):
//
// The original Dashboard embeds `<KanbanDashboard />`, a "Multi-Agent
// Command Center" (920 lines) that itself pulls in `HermesAimPanel` (722
// lines), `GenericAimPanel` (883 lines), `FleetDiscoveryService` (232 lines)
// and `HermesAgentOrchestrator` (530 lines) — roughly 3,300 lines combined.
// It has a hard (non-optional-chained) dependency on
// `window.electronAPI.aiAgents.get()` plus mesh-dispatch and SSH-based
// fleet-deploy machinery that functionally overlaps with the Hire Agents,
// Compute & Nodes, and Deploy System tabs this addon was explicitly told to
// drop (decision scope, §10 Phase 6). Porting the full Kanban stack would
// mean re-implementing those dropped tabs' functionality inside "Dashboard"
// under a different name, and would require plumbing a large surface of
// fleet/mesh state this addon's manifest permissions were not written for.
//
// Rather than port it wholesale or silently drop it, this panel keeps the
// two pieces of Dashboard that are genuinely in scope and self-contained —
// summary stat tiles, and AIM Forge (already ported, Hermes-scoped) — and
// replaces the Kanban board with an explicit empty-state panel naming what's
// missing and why, consistent with the "known stubs get empty states"
// guidance (e.g. the SSH-based deploy column has no addon-side equivalent).
// =============================================================================

import React, { useEffect, useState } from "react";
import { LayoutDashboard, Bot, Zap, Package as PackageIcon, GraduationCap } from "lucide-react";
import { skillMarketplace } from "../services/SkillMarketplaceService";
import { stargateRegistry } from "../services/StargateSkillRegistry";
import AIMForgePanel from "./AIMForgePanel";

const HYPERINSIGHT_AIMS_URL = "https://api.hyperinsight.app/v1/aims/list";

export const DashboardPanel: React.FC = () => {
  const [aimCount, setAimCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const resp = await fetch(HYPERINSIGHT_AIMS_URL, { signal: ctrl.signal });
        clearTimeout(t);
        if (!resp.ok) throw new Error(String(resp.status));
        const data = await resp.json().catch(() => null);
        const list = Array.isArray(data) ? data : Array.isArray(data?.aims) ? data.aims : [];
        if (!cancelled) setAimCount(list.length);
      } catch {
        if (!cancelled) setAimCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = skillMarketplace.getStats();
  const bundleCount = stargateRegistry.getBundles().length;
  const trainingCount = stargateRegistry.getTrainingJobs().length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Intelligence Dashboard</h3>
          <p className="text-sm text-gray-400 mt-0.5">
            Overview of your AI Models, skills, bundles, and training activity.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot size={18} className="text-purple-300" />
            {aimCount === null ? "—" : aimCount}
          </div>
          <div className="text-sm text-gray-400">HyperCycle AIMs</div>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap size={18} className="text-green-300" />
            {stats.totalSkills}
          </div>
          <div className="text-sm text-gray-400">Skills</div>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            <PackageIcon size={18} className="text-amber-300" />
            {bundleCount}
          </div>
          <div className="text-sm text-gray-400">Bundles</div>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            <GraduationCap size={18} className="text-cyan-300" />
            {trainingCount}
          </div>
          <div className="text-sm text-gray-400">Training Jobs</div>
        </div>
      </div>

      {/* Multi-Agent Command Center — not available in this addon.
          See the file header comment for why the Kanban/fleet/SSH stack was
          not ported. */}
      <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/30 p-6 text-center">
        <LayoutDashboard size={28} className="mx-auto text-gray-700 mb-2" />
        <p className="text-gray-400 text-sm font-medium">Multi-Agent Command Center isn't available in this addon.</p>
        <p className="text-gray-600 text-xs mt-1 max-w-md mx-auto">
          The full Kanban board (fleet discovery, mesh dispatch, and SSH-based deploy) lives in Mosaic-core
          subsystems this addon doesn't have permission to reach, and overlaps with the Hire Agents / Compute &amp;
          Nodes / Deploy System tabs that aren't part of this addon.
        </p>
      </div>

      {/* AIM Forge — Hermes agents only (per §10 Phase 6 scope) */}
      <div>
        <h4 className="font-medium text-white flex items-center gap-2 mb-3">
          <Bot size={16} className="text-cyan-400" />
          AIM Forge
        </h4>
        <AIMForgePanel />
      </div>
    </div>
  );
};

export default DashboardPanel;
