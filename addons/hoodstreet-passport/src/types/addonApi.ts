/**
 * HoodStreet Passport — addonAPI surface typing
 *
 * This addon only uses the documented addonAPI subset for third-party addons:
 *   - addonAPI.mcp.{listServers, listTools, callTool}
 *   - addonAPI.settings.{get, set}
 *   - addonAPI.files.{read, write, list, mkdir}
 *   - addonAPI.events.on
 *   - addonAPI.ui.openExternal
 *
 * No `window.electronAPI` is used. The addon must work standalone in a
 * browser with a demo-mode fallback (per the addon-demo-mode-pattern).
 */

export interface McpCallResult {
  content?: Array<{ type: string; text: string }>;
  isError?: boolean;
  raw?: unknown;
}

export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema?: unknown;
  /**
   * Optional add-on categorization. The live MCP only returns
   * {name, description, inputSchema}; we extend locally so the Tools view
   * can render status badges and group the catalog by access pattern.
   */
  category?: 'read' | 'prepare' | 'execute';
  /**
   * Optional add-on argument shape. Same caveat as category: a UI helper
   * for the Tools view, not part of the live MCP wire format.
   */
  args?: Record<string, string>;
}

export interface McpServerInfo {
  id: string;
  name?: string;
  status?: 'connected' | 'disconnected' | string;
  tools?: McpToolInfo[];
}

export interface AddonSettings {
  lastTokenId?: string;
  refreshMinutes?: number;
  theme?: 'lime-dark' | 'cool-dark';
}

export interface AddonFiles {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  list(path: string): Promise<string[]>;
  mkdir(path: string): Promise<void>;
}

export interface AddonEvents {
  on(channel: string, cb: (payload: unknown) => void): () => void;
}

export interface AddonUI {
  openExternal(url: string): Promise<void>;
}

export interface AddonMcp {
  listServers(): Promise<McpServerInfo[]>;
  listTools(serverId: string): Promise<{ tools: McpToolInfo[] } | McpToolInfo[]>;
  callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<McpCallResult>;
}

export interface AddonAPI {
  mcp: AddonMcp;
  settings: {
    get(): Promise<AddonSettings>;
    set(patch: Partial<AddonSettings>): Promise<void>;
  };
  files: AddonFiles;
  events: AddonEvents;
  ui: AddonUI;
}

declare global {
  interface Window {
    addonAPI?: AddonAPI;
  }
}

export {};
