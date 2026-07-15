/**
 * `window.addonAPI` surface, as exposed by mosaic-companion's
 * `electron/addon-preload.ts` (§5.3). This addon has no `electronAPI` access
 * at all — only this. Kept intentionally narrow to what Stargate's 7 tabs
 * actually use; see mosaic-companion's own `global.d.ts` for the full
 * cross-addon surface if this ever needs to grow.
 */

interface AddonApiError {
  code: string;
  message: string;
}

interface AgentSummary {
  id: string;
  name: string;
  provider?: unknown;
  model?: unknown;
  isActive?: unknown;
}

interface McpToolResult {
  content?: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

declare global {
  interface Window {
    addonAPI: {
      parseError: (error: unknown) => AddonApiError;
      system: {
        getManifest: () => Promise<unknown>;
        getAppInfo: () => Promise<{ appVersion: string; platform: string; locale: string }>;
        getTheme: () => Promise<{ themeKey: string; cssVars: Record<string, string> }>;
      };
      settings: {
        get: () => Promise<Record<string, unknown>>;
        set: (patch: Record<string, unknown>) => Promise<void>;
        replace: (value: Record<string, unknown>) => Promise<void>;
        clear: () => Promise<void>;
      };
      files: {
        read: (relPath: string) => Promise<string | null>;
        readBinary: (relPath: string) => Promise<Uint8Array | null>;
        write: (relPath: string, contents: string | Uint8Array) => Promise<void>;
        list: (relDir?: string) => Promise<Array<{ name: string; isDir: boolean; size: number; mtime: number }>>;
        delete: (relPath: string) => Promise<void>;
        mkdir: (relDir: string) => Promise<void>;
      };
      events: {
        on: (channel: string, cb: (payload: unknown) => void) => () => void;
      };
      ui: {
        setTitle: (title: string) => Promise<void>;
        openExternal: (url: string) => Promise<void>;
      };
      wallet: {
        getAddress: () => Promise<string | null>;
        getBalance: (tokenSymbol?: string) => Promise<{ symbol: string; balance: string; decimals: number } | null>;
        getNetworkInfo: () => Promise<{ networkId: string; chainId: number; name: string; rpcConfigured: boolean }>;
      };
      agents: {
        list: () => Promise<AgentSummary[]>;
        get: (id: string) => Promise<AgentSummary | null>;
        add: (agent: Record<string, unknown>) => Promise<{ id: string | number }>;
        update: (id: string, patch: Record<string, unknown>) => Promise<void>;
      };
      mcp: {
        listServers: () => Promise<Array<{ id: string; name: string; connected: boolean }>>;
        listTools: (serverId: string) => Promise<unknown>;
        callTool: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<McpToolResult>;
      };
      nodes: {
        list: () => Promise<Array<{ id: string; name: string; apiHost: string; apiPort?: string; isActive: boolean; licenseKey?: string }>>;
        getSavedAims: (license?: string) => Promise<unknown>;
      };
      invoke: (method: string, ...args: unknown[]) => Promise<unknown>;
      init: () => Promise<{
        addonId: string;
        manifest: unknown;
        theme: { themeKey: string; cssVars: Record<string, string> };
        platform: string;
        appVersion: string;
        locale: string;
      } | null>;
    };
    /** Must be undefined in this addon — verified by the Phase 6 test harness. */
    electronAPI?: undefined;
  }
}

export {};
