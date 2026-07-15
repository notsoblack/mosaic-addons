/**
 * Trimmed subset of mosaic-companion's `src/services/AdaPortal/types.ts`,
 * covering only the 7 sub-tabs kept in this addon (§10 Phase 6). Types
 * backing Hire Agents / Compute & Nodes / Stargate Pool / Deploy System were
 * dropped along with those tabs.
 */

export interface AIMInfo {
  name: string;
  version: string | null;
  description: string | null;
  rank?: number;
  activeNodes?: number;
  computeTFLOPS?: number;
  cpuCores?: number;
  ramGB?: number;
  vramGB?: number;
  origin?: string;
  hypercycle_id?: string;
  license?: string;
  isActive?: boolean;
  bestLivenessScore?: number;
  bestEndpointUrl?: string;
  estimatedCostUsdc?: number | null;
  manifestVersion?: string | null;
  // Community / Remote AIM fields
  isRemote?: boolean;
  operatorName?: string;
  operatorContact?: string;
  endpointUrl?: string;
  healthUrl?: string;
  manifestUrl?: string;
  requestUrl?: string;
  pricePerCall?: number;
  priceToken?: string;
  nodeId?: string;
  licenseId?: string;
  supportedQueries?: string[];
}

export type AgentRole = "marketing" | "developer" | "uiux" | "data_analyst" | "growth";

export type LeaderboardPeriod = "daily" | "weekly" | "all_time";

export interface TrainingListing {
  listingId: string;
  trainerId: string;
  trainerName: string;
  specializations: string[];
  pricePerSession: number;
  description: string;
  rating: number;
}

export interface PackageAgent {
  agentId: string;
  name: string;
  role: AgentRole;
  included: boolean;
}

export interface AgentPackage {
  packageId: string;
  name: string;
  description: string;
  agents: PackageAgent[];
  computeAllocation?: number;
  price: number;
  popular: boolean;
}

export type UnifiedLeaderboardSection = "agents" | "aims" | "nodes";

export interface UnifiedLeaderboardEntry {
  type: UnifiedLeaderboardSection;
  id: string;
  name: string;
  rank: number;
  score: number;
  role?: AgentRole;
  rating?: number;
  successRate?: number;
  activeNodes?: number;
  computeTFLOPS?: number;
  uptime?: number;
  reliability?: number;
  availableCompute?: number;
}

/** Trimmed to only the 7 kept tabs' worth of intents — 'launch_project' etc.
 * still route through the same "Start" grid, but their target tabs
 * (compute_nodes, stargate_pool, deploy_system) were dropped along with
 * those tabs; Start no longer offers cards that would dead-end. */
export type UserIntent = "rankings" | "bundles" | "dashboard" | "forge_aim" | "custom";

export interface IntentOption {
  intent: UserIntent;
  label: string;
  description: string;
  icon: string;
}
