/**
 * Browser half of the settings API — same-origin fetch, document-relative
 * paths (the GUI is served under <base href="./">", so root-absolute
 * /api/... would break on sub-path deployments; relative paths track the
 * page wherever the host mounts it).
 */
import type { ActivitySnapshot, BgStudioSettings, ImageEntry, SettingsPayload, WallpaperEntry } from '../shared/protocol.ts'

const BASE = 'api/dsh-bg-studio'

async function json<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) throw new Error(`bg-studio api ${res.status}`)
  return res.json() as Promise<T>
}

export function imageUrl(id: string): string {
  return `${BASE}/image?id=${encodeURIComponent(id)}`
}

export async function fetchSettings(): Promise<SettingsPayload> {
  return json<SettingsPayload>(`${BASE}/settings`, { cache: 'no-store' })
}

export async function saveSettings(patch: Record<string, unknown>): Promise<SettingsPayload> {
  return json<SettingsPayload>(`${BASE}/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  })
}

export async function resetSettings(): Promise<SettingsPayload> {
  return json<SettingsPayload>(`${BASE}/reset`, { method: 'POST' })
}

export async function uploadImage(file: File): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/images?name=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { 'content-type': file.type || 'image/png' },
    body: file,
  })
  if (!res.ok) throw new Error(`bg-studio upload ${res.status}`)
  return res.json() as Promise<{ id: string }>
}

export async function deleteImage(id: string): Promise<void> {
  const res = await fetch(`${BASE}/images?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`bg-studio delete ${res.status}`)
}

/** Ask the desktop window for a DWM system material (best-effort; web/CLI
 * hosts answer {ok:false}). Returns the host's verdict. */
export async function setWindowMaterial(material: 'acrylic' | 'mica' | 'none'): Promise<{ ok: boolean; detail: string }> {
  const res = await fetch(`${BASE}/window-material`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ material }),
  })
  if (!res.ok) throw new Error(`bg-studio window-material ${res.status}`)
  return res.json() as Promise<{ ok: boolean; detail: string }>
}

/* ------------------------- wallpaper bundles ------------------------- */

export function assetUrl(bundleId: string, path: string): string {
  return `${BASE}/asset?id=${encodeURIComponent(bundleId)}&path=${encodeURIComponent(path)}`
}

export function manifestUrl(bundleId: string): string {
  return assetUrl(bundleId, 'manifest.json')
}

export async function fetchWallpapers(): Promise<WallpaperEntry[]> {
  const payload = await json<{ wallpapers: WallpaperEntry[] }>(`${BASE}/wallpapers`, { cache: 'no-store' })
  return payload.wallpapers
}

export async function importWallpaper(dir: string): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/wallpapers?dir=${encodeURIComponent(dir)}`, { method: 'POST' })
  if (!res.ok) throw new Error((await res.json().catch(() => ({})) as { error?: string }).error ?? `import ${res.status}`)
  return res.json() as Promise<{ id: string }>
}

export async function deleteWallpaper(id: string): Promise<void> {
  const res = await fetch(`${BASE}/wallpapers?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`bg-studio wallpaper delete ${res.status}`)
}

export async function fetchActivity(threshold: number): Promise<ActivitySnapshot> {
  return json<ActivitySnapshot>(`${BASE}/activity?threshold=${encodeURIComponent(String(threshold))}`, { cache: 'no-store' })
}

/** Current dark-scheme decision, from the same body attribute the app's own
 * ThemePresenter maintains (see the theme module's contract). */
export function isDarkScheme(): boolean {
  if (typeof document === 'undefined') return false
  const scheme = getComputedStyle(document.documentElement).colorScheme
  if (scheme) return scheme.includes('dark')
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

/** Notify on dark/light flips by watching the body attribute mutations. */
export function subscribeColorScheme(callback: () => void): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}
  const observer = new MutationObserver(callback)
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
  return () => observer.disconnect()
}

export type { BgStudioSettings, ImageEntry }
