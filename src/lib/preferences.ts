import { useSyncExternalStore } from 'react';
export interface Preferences { density: 'comfortable' | 'compact'; textSize: 'normal' | 'large'; cloudDocuments: boolean; sidebarWidth: number; sidebarCollapsed: boolean; }
const defaults: Preferences = { density: 'comfortable', textSize: 'normal', cloudDocuments: false, sidebarWidth: 260, sidebarCollapsed: false };
const listeners = new Set<() => void>();
let preferenceOwner = 'local-guest';
const key = () => `aishukatsu-preferences-v1:${preferenceOwner}`;
function read(): Preferences { try { return { ...defaults, ...JSON.parse(localStorage.getItem(key()) ?? '{}') }; } catch { return defaults; } }
let current = read();
export function getPreferences() { return current; }
export function updatePreferences(patch: Partial<Preferences>) {
  current = { ...current, ...patch };
  try { localStorage.setItem(key(), JSON.stringify(current)); } catch {}
  listeners.forEach(listener => listener());
}
export function usePreferences() { return useSyncExternalStore(callback => { listeners.add(callback); return () => { listeners.delete(callback); }; }, () => current); }
export function isLocalMode() { try { return localStorage.getItem('aishukatsu-local-mode') === '1'; } catch { return false; } }
export function enableLocalMode() { localStorage.setItem('aishukatsu-local-mode', '1'); window.location.reload(); }
export function platformShortcut(key: string) { return /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘'+key.replace('Shift+','⇧') : 'Ctrl+'+key; }

export function setPreferenceOwner(owner: string) {
  if (preferenceOwner === owner) return;
  preferenceOwner = owner; current = read(); listeners.forEach(listener => listener());
}
