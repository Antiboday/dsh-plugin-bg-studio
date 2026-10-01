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
  /** Reserved for the animated wallpaper family (video / canvas / web view /
   * shader). Not selectable in this version; the settings section below
   * already carries what a future provider needs. */
  // | 'animated'

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
  /** Resource reference (library media id or URL) of the future wallpaper. */
  mediaSource: string | null
  /** Honor the OS reduced-motion preference by freezing the wallpaper. */
  respectReducedMotion: boolean
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
  animated: { mediaSource: null, respectReducedMotion: true },
  panelOpaque: true,
}

/** Clamp n into [min, max]; NaN falls back to min. */
export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

/** Clamp/repair one raw settings object into a valid BgStudioSettings.
 * Used by the host on write and by the client on read. */
export function sanitizeSettings(raw: unknown): BgStudioSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const img = (src.image && typeof src.image === 'object' ? src.image : {}) as Record<string, unknown>
  const tra = (src.transparent && typeof src.transparent === 'object' ? src.transparent : {}) as Record<string, unknown>
  const fro = (src.frosted && typeof src.frosted === 'object' ? src.frosted : {}) as Record<string, unknown>
  const ani = (src.animated && typeof src.animated === 'object' ? src.animated : {}) as Record<string, unknown>
  const kind = ['none', 'image', 'transparent', 'frosted'].includes(src.kind as string)
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
      mediaSource: typeof ani.mediaSource === 'string' ? ani.mediaSource : null,
      respectReducedMotion: ani.respectReducedMotion !== false,
    },
    panelOpaque: src.panelOpaque !== false,
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
