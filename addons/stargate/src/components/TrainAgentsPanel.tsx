// =============================================================================
// TRAIN AGENTS PANEL
//
// Adapted from mosaic-companion's renderTraining() inside AdaPortalPanel.tsx
// (origin/stargate-module @ 84c36c4, lines ~2449-2517).
//
// Data source: `stargateRegistry.getTrainingJobs()` (self-contained,
// localStorage-backed, already ported for this addon).
//
// The original's "My AI Agents" button opened a shared `AgentSelectModal`
// (a large, multi-purpose modal also used by the dropped Hire Agents tab)
// backed by `window.electronAPI.aiAgents.get()`. This addon has
// `agents:read`/`agents:write` permission instead, exposed as
// `addonAPI.agents.list()` — a much narrower, already-adapted surface — so
// rather than port the shared modal, "Book Training" now opens a small
// inline picker built directly on `addonAPI.agents.list()`.
// =============================================================================

import React, { useEffect, useState } from "react";
import { Bot, GraduationCap, Star, X } from "lucide-react";
import { toast } from "react-toastify";
import { stargateRegistry } from "../services/StargateSkillRegistry";
import type { TrainingJob } from "../services/StargateSkillRegistry";

interface AgentSummary {
  id: string;
  name: string;
  provider?: unknown;
  model?: unknown;
  isActive?: unknown;
}

export const TrainAgentsPanel: React.FC = () => {
  const [trainingListings, setTrainingListings] = useState<TrainingJob[]>([]);
  const [selectedTrainer, setSelectedTrainer] = useState<TrainingJob | null>(null);
  const [myAgents, setMyAgents] = useState<AgentSummary[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<TrainingJob | null>(null);

  useEffect(() => {
    setTrainingListings(stargateRegistry.getTrainingJobs());
  }, []);

  const openPicker = async (job: TrainingJob) => {
    setPickerTarget(job);
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

  const bookTraining = (agent: AgentSummary) => {
    if (!pickerTarget) return;
    toast.success(`Booked ${agent.name} into "${pickerTarget.name || pickerTarget.model} training".`);
    setPickerOpen(false);
    setPickerTarget(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Train Your Agents</h3>
          <p className="text-sm text-gray-400 mt-0.5">
            Find trainers and improve your agents with custom skills and data.
          </p>
        </div>
        <span className="text-sm text-gray-400">{trainingListings.length} jobs in your registry</span>
      </div>

      {trainingListings.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-800 rounded-xl">
          <GraduationCap size={32} className="mx-auto text-gray-700 mb-2" />
          <p className="text-gray-500 text-sm">No training jobs yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {trainingListings.map((job) => (
            <div
              key={job.id}
              onClick={() => setSelectedTrainer(selectedTrainer?.id === job.id ? null : job)}
              className={`bg-gray-800/50 rounded-lg p-4 border transition-colors cursor-pointer ${
                selectedTrainer?.id === job.id ? "border-purple-500 bg-purple-900/10" : "border-gray-700 hover:border-purple-500/30"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-white">{job.name || `${job.model} Training`}</h4>
                  <p className="text-sm text-gray-400 mt-1">
                    Training {job.model} on {job.dataset} &middot; Status: {job.status}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-xs px-2 py-0.5 bg-purple-900/50 rounded-full text-purple-300">{job.status}</span>
                    <span className="text-xs px-2 py-0.5 bg-purple-900/50 rounded-full text-purple-300">{job.model}</span>
                  </div>
                  {job.status === "completed" && (
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                      <Star size={14} className="text-yellow-500" />
                      <span>5.0</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-purple-400">{job.progress}%</div>
                  <div className="text-xs text-gray-500">progress</div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openPicker(job);
                }}
                disabled={!selectedTrainer || selectedTrainer.id !== job.id}
                className="mt-3 w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <GraduationCap size={16} />
                Book Training
              </button>
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
                    onClick={() => bookTraining(agent)}
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

export default TrainAgentsPanel;
