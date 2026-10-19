/**
 * HoodStreet Passport — addon-local persistence
 *
 * Stores cached reports in the addon's jailed data dir (ctx.paths.data) when
 * addonAPI is available, otherwise falls back to localStorage for demo mode.
 * The addon NEVER writes to Vault (per vault-readonly-pattern).
 */

import type { AddonAPI } from '../types/addonApi';

const LS_PREFIX = 'hoodstreet-passport:';

export async function readJson<T>(api: AddonAPI | undefined, filePath: string): Promise<T | null> {
  if (api) {
    try {
      const raw = await api.files.read(filePath);
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  try {
    const raw = localStorage.getItem(LS_PREFIX + filePath);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeJson(api: AddonAPI | undefined, filePath: string, value: unknown): Promise<void> {
  const raw = JSON.stringify(value, bigintReplacer, 2);
  if (api) {
    try {
      const dir = filePath.split('/').slice(0, -1).join('/');
      if (dir) await api.files.mkdir(dir).catch(() => undefined);
      await api.files.write(filePath, raw);
      return;
    } catch {
      // fall through to localStorage
    }
  }
  localStorage.setItem(LS_PREFIX + filePath, raw);
}

export async function readSetting<K extends string>(api: AddonAPI | undefined, key: K, fallback: string): Promise<string> {
  if (api) {
    const s = await api.settings.get();
    return (s as unknown as Record<string, string>)[key] ?? fallback;
  }
  return localStorage.getItem(LS_PREFIX + 'setting:' + key) ?? fallback;
}

export async function writeSetting(api: AddonAPI | undefined, key: string, value: string): Promise<void> {
  if (api) {
    await api.settings.set({ [key]: value } as unknown as Parameters<AddonAPI['settings']['set']>[0]);
    return;
  }
  localStorage.setItem(LS_PREFIX + 'setting:' + key, value);
}

function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  return value;
}
