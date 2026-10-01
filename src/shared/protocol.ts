/**
 * Shared protocol between the bg-studio host plugin and its web client.
 *
 * The settings shape is the single source of truth for every background
 * mode. Adding a mode (the planned animated-wallpaper family) means:
 *   1. add a BackgroundKind literal and a settings section here,
 *   2. implement a client provider under src/client/providers/,
 *   3. register it in the provider table in src/client/background.ts.
 * The host never interprets modes; it only stores and serves them, so it
 * needs no change for new modes.
 */

/** Background mode selected by the user. */
export type BackgroundKind =
  | 'none'
  | 'image'
  | 'transparent'
  | 'frosted'
  | 'animated'

/** Image background parameters. */
export interface ImageBackgroundSettings {
  /** Selected library image id, or null for the fallback gradient. */
  imageId: string | null
  /** How the image fills the window. */
  fit: 'cover' | 'contain' | 'tile'
  /** Image opacity, 0..1 (1 = fully visible). */
  opacity: number
  /** Blur applied to the image itself, 0..40 px. */
  blur: number
  /** Dark scrim over the image for text readability, 0..0.8. */
  dim: number
  /** Optional scrim color; null = auto (black scrim in both schemes). */
  tint: string | null
}

/** Transparent mode parameters. */
export interface TransparentSettings {
  /** How much of the surface fill to keep, 0..1 (0 = fully see-through). */
  surfaceOpacity: number
  /** Global readability scrim behind all content, 0..0.5. */
  scrim: number
}

/** Frosted-glass mode parameters. */
export interface FrostedSettings {
  /** backdrop-filter blur radius, 4..48 px. */
  blur: number
  /** Glass surface fill opacity, 0.15..0.9. */
  surfaceOpacity: number
  /** Background saturation boost, 1..1.8. */
  saturation: number
  /** Optional library image used as the glass backdrop; null = built-in
   * neutral gradient (so the blur always has something to sample). */
  imageId: string | null
}

/** Reserved section for the future animated provider, kept in the wire
 * format now so old installs keep working when it ships. */
export interface AnimatedReservedSettings {
  /** Id of the active wallpaper bundle in the host library. */
  mediaSource: string | null
  /** Honor the OS reduced-motion preference by freezing the wallpaper. */
  respectReducedMotion: boolean
  /** Per-bundle overrides (wallpaper-local settings; WE-style ⚙). */
  perBundle: Record<string, BundleSettings>
}

/** Wallpaper-local settings. Each bundle type reads what it needs; the
 * panel shows only the controls relevant to the bundle's type. */
export interface BundleSettings {
  /** video: 0..1 (0 = muted, the safe default for a wallpaper). */
  volume: number
  /** video: 0.25..4 playback rate. */
  rate: number
  /** video: how the movie fills the window. */
  fit: 'cover' | 'contain' | 'fill'
  /** character: 1..16 — tasks above this count read as "overloaded". */
  taskThreshold: number
  /** character: seconds between idle-clip rotations. */
  idleRotateSec: number
}

export const DEFAULT_BUNDLE_SETTINGS: BundleSettings = {
  volume: 0,
  rate: 1,
  fit: 'cover',
  taskThreshold: 3,
  idleRotateSec: 120,
}

/** Full plugin settings. */
export interface BgStudioSettings {
  kind: BackgroundKind
  image: ImageBackgroundSettings
  transparent: TransparentSettings
  frosted: FrostedSettings
  /** Reserved: see AnimatedReservedSettings. */
  animated: AnimatedReservedSettings
  /** Keep the settings panel itself on an opaque base while the rest of the
   * UI goes transparent/glass. Users may turn it off to theme the panel too. */
  panelOpaque: boolean
  /** Keep DSH's own system dialogs (Settings etc.) opaque in background
   * modes — independent from the plugin panel preference. */
  systemDialogsOpaque: boolean
}

/** One image library entry (metadata only; bytes are served by route). */
export interface ImageEntry {
  id: string
  name: string
  bytes: number
  mime: string
  addedAt: number
}

/** Response of GET /api/dsh-bg-studio/settings. */
export interface SettingsPayload {
  settings: BgStudioSettings
  images: ImageEntry[]
}

export const DEFAULT_SETTINGS: BgStudioSettings = {
  kind: 'none',
  image: { imageId: null, fit: 'cover', opacity: 1, blur: 0, dim: 0.25, tint: null },
  transparent: { surfaceOpacity: 0, scrim: 0.08 },
  frosted: { blur: 18, surfaceOpacity: 0.55, saturation: 1.25, imageId: null },
  animated: { mediaSource: null, respectReducedMotion: true, perBundle: {} },
  panelOpaque: true,
  systemDialogsOpaque: true,
}

/** Clamp n into [min, max]; NaN falls back to min. */
export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

/** Sanitize one bundle-settings blob. */
export function sanitizeBundleSettings(raw: unknown): BundleSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    volume: clamp(Number(src.volume ?? 0), 0, 1),
    rate: clamp(Number(src.rate ?? 1), 0.25, 4),
    fit: ['cover', 'contain', 'fill'].includes(src.fit as string) ? (src.fit as BundleSettings['fit']) : 'cover',
    taskThreshold: clamp(Number(src.taskThreshold ?? 3), 1, 16),
    idleRotateSec: clamp(Number(src.idleRotateSec ?? 120), 5, 3600),
  }
}

function sanitizePerBundle(raw: unknown, legacyThreshold: unknown, legacyRotate: unknown): Record<string, BundleSettings> {
  const out: Record<string, BundleSettings> = {}
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  for (const [id, value] of Object.entries(src)) {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) continue
    out[id] = sanitizeBundleSettings(value)
  }
  // One-time migration from the pre-0.3 global dials into existing bundles.
  if (legacyThreshold !== undefined || legacyRotate !== undefined) {
    const th = clamp(Number(legacyThreshold ?? 3), 1, 16)
    const rot = clamp(Number(legacyRotate ?? 120), 5, 3600)
    for (const id of Object.keys(out)) {
      out[id] = { ...out[id], taskThreshold: th, idleRotateSec: rot }
    }
  }
  return out
}

/** Clamp/repair one raw settings object into a valid BgStudioSettings.
 * Used by the host on write and by the client on read. */
export function sanitizeSettings(raw: unknown): BgStudioSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const img = (src.image && typeof src.image === 'object' ? src.image : {}) as Record<string, unknown>
  const tra = (src.transparent && typeof src.transparent === 'object' ? src.transparent : {}) as Record<string, unknown>
  const fro = (src.frosted && typeof src.frosted === 'object' ? src.frosted : {}) as Record<string, unknown>
  const ani = (src.animated && typeof src.animated === 'object' ? src.animated : {}) as Record<string, unknown>
  const kind = ['none', 'image', 'transparent', 'frosted', 'animated'].includes(src.kind as string)
    ? (src.kind as BackgroundKind)
    : 'none'
  return {
    kind,
    image: {
      imageId: typeof img.imageId === 'string' ? img.imageId : null,
      fit: ['cover', 'contain', 'tile'].includes(img.fit as string) ? (img.fit as 'cover' | 'contain' | 'tile') : 'cover',
      opacity: clamp(Number(img.opacity ?? 1), 0, 1),
      blur: clamp(Number(img.blur ?? 0), 0, 40),
      dim: clamp(Number(img.dim ?? 0.25), 0, 0.8),
      tint: typeof img.tint === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(img.tint) ? img.tint : null,
    },
    transparent: {
      surfaceOpacity: clamp(Number(tra.surfaceOpacity ?? 0), 0, 1),
      scrim: clamp(Number(tra.scrim ?? 0.08), 0, 0.5),
    },
    frosted: {
      blur: clamp(Number(fro.blur ?? 18), 4, 48),
      surfaceOpacity: clamp(Number(fro.surfaceOpacity ?? 0.55), 0.15, 0.9),
      saturation: clamp(Number(fro.saturation ?? 1.25), 1, 1.8),
      imageId: typeof fro.imageId === 'string' ? fro.imageId : null,
    },
    animated: {
      mediaSource: typeof ani.mediaSource === 'string' && ani.mediaSource !== '' ? ani.mediaSource : null,
      respectReducedMotion: ani.respectReducedMotion !== false,
      // Per-bundle map, each entry sanitized; legacy global threshold/rotate
      // values migrate into each existing bundle's settings once.
      perBundle: sanitizePerBundle(ani.perBundle, ani.taskThreshold, ani.idleRotateSec),
    },
    panelOpaque: src.panelOpaque !== false,
    systemDialogsOpaque: src.systemDialogsOpaque !== false,
  }
}

/** Merge a partial settings patch over current values, returning a fully
 * sanitized result (per-section replace, field-level repair). */
export function applySettingsPatch(current: BgStudioSettings, patch: unknown): BgStudioSettings {
  const p = (patch && typeof patch === 'object' ? patch : {}) as Record<string, unknown>
  return sanitizeSettings({ ...current, ...p })
}

/** MIME types accepted into the image library, mapped to file extensions. */
export const IMAGE_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
}

/* ------------------------------------------------------------------------- *
 * Wallpaper bundles — the "dsh-wallpaper/1" package format.
 *
 * A bundle is a DIRECTORY inside the host library:
 *   <storages>/dsh-plugin-bg-studio/wallpapers/<id>/
 *       manifest.json   (this format)
 *       ...assets       (html/js/mp4/png/json — served by the asset route)
 *
 * `type` selects the renderer:
 *   video      entry = video file inside the bundle        → <video>
 *   web        entry = html file inside the bundle         → sandboxed iframe
 *   canvas     entry = "scene:<name>" of a built-in scene  → canvas renderer
 *   character  entry = mascot.json (sprite sheet + states) → state machine
 *
 * character's mascot.json describes the sprite sheet and per-state clips:
 *   { "sheet": "sheet.png", "frameW": 128, "frameH": 128,
 *     "clips": { "idle-a": [0,24], "idle-b": [24,48], "work": [48,72] },
 *     "fps": 12 }
 * States come from the manifest's `states` map below; `idle` lists several
 * clips that rotate (interval from settings), busy/overloaded map task
 * counts (threshold from settings).
 * ------------------------------------------------------------------------- */

export const WALLPAPER_FORMAT = 'dsh-wallpaper/1'

export type WallpaperType = 'video' | 'web' | 'canvas' | 'character'

/** One wallpaper bundle's manifest (manifest.json). */
export interface WallpaperManifest {
  format: typeof WALLPAPER_FORMAT
  name: string
  description: string
  author: string
  type: WallpaperType
  entry: string
  /** character-type state mapping; clip names index mascot.json clips. */
  states?: {
    idle: string[]
    busy: string[]
    overloaded: string[]
  }
}

/** Bundle listing entry returned by the host. */
export interface WallpaperEntry {
  id: string
  name: string
  type: WallpaperType
  description: string
  author: string
  entry: string
  /** Parse/validation problem, when the manifest is unusable. */
  error?: string
}

/** Mascot descriptor for character wallpapers (mascot.json). */
export interface MascotSpec {
  sheet: string
  frameW: number
  frameH: number
  fps: number
  clips: Record<string, [number, number]>
}

/** Live agent-activity snapshot served by the host bridge. */
export interface ActivitySnapshot {
  /** Sessions with a started-but-not-finished turn. */
  activeTasks: number
  /** Derived machine state, using the caller's threshold. */
  state: 'idle' | 'busy' | 'overloaded'
}
