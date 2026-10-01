/**
 * Host-side persistence for bg-studio: a settings JSON plus an image
 * library directory under the DSH storage root.
 *
 *   <dataDir>/settings.json          — the full BgStudioSettings blob
 *   <dataDir>/images/<id>.<ext>      — library image bytes
 *
 * Writes are atomic (tmp file + rename). Every read repairs the blob through
 * sanitizeSettings so a hand-edited or half-written file can never break the
 * boot; corrupt library entries are skipped, never thrown.
 */
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile, cp, rm } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { join, normalize, extname } from 'node:path'
import {
  DEFAULT_SETTINGS,
  IMAGE_MIME_EXT,
  WALLPAPER_FORMAT,
  applySettingsPatch,
  sanitizeSettings,
  type BgStudioSettings,
  type ImageEntry,
  type WallpaperEntry,
  type WallpaperManifest,
} from '../shared/protocol.ts'

/** Loose mime map for bundle assets (fall back to octet-stream). */
const ASSET_MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

export class BgStudioStore {
  constructor(private readonly dataDir: string) {}

  private get settingsPath(): string {
    return join(this.dataDir, 'settings.json')
  }

  private get imagesDir(): string {
    return join(this.dataDir, 'images')
  }

  private get wallpapersDir(): string {
    return join(this.dataDir, 'wallpapers')
  }

  async ensureDirs(): Promise<void> {
    await mkdir(this.imagesDir, { recursive: true })
  }

  /** Load settings, repairing shape errors; missing file = defaults. */
  async loadSettings(): Promise<BgStudioSettings> {
    try {
      const text = await readFile(this.settingsPath, 'utf8')
      return sanitizeSettings(JSON.parse(text))
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  }

  /** Merge a patch and persist atomically; returns the stored result. */
  async savePatch(patch: unknown): Promise<BgStudioSettings> {
    const next = applySettingsPatch(await this.loadSettings(), patch)
    const body = JSON.stringify(next, null, 2) + '\n'
    await mkdir(this.dataDir, { recursive: true })
    const tmp = join(this.dataDir, `settings.json.${randomBytes(4).toString('hex')}.tmp`)
    await writeFile(tmp, body, 'utf8')
    await rename(tmp, this.settingsPath)
    return next
  }

  /** Reset to defaults and persist. */
  async reset(): Promise<BgStudioSettings> {
    const body = JSON.stringify(DEFAULT_SETTINGS, null, 2) + '\n'
    await mkdir(this.dataDir, { recursive: true })
    const tmp = join(this.dataDir, `settings.json.${randomBytes(4).toString('hex')}.tmp`)
    await writeFile(tmp, body, 'utf8')
    await rename(tmp, this.settingsPath)
    return { ...DEFAULT_SETTINGS }
  }

  /** List library images with metadata; unreadable entries are skipped. */
  async listImages(): Promise<ImageEntry[]> {
    let names: string[]
    try {
      names = await readdir(this.imagesDir)
    } catch {
      return []
    }
    const entries: ImageEntry[] = []
    for (const name of names) {
      const dot = name.lastIndexOf('.')
      if (dot <= 0) continue
      const ext = name.slice(dot + 1).toLowerCase()
      const mime = Object.entries(IMAGE_MIME_EXT).find(([, e]) => e === ext)?.[0]
      if (!mime) continue
      try {
        const info = await stat(join(this.imagesDir, name))
        if (!info.isFile()) continue
        entries.push({
          id: name.slice(0, dot),
          name,
          bytes: info.size,
          mime,
          addedAt: info.mtimeMs,
        })
      } catch {
        /* raced away — skip */
      }
    }
    entries.sort((a, b) => b.addedAt - a.addedAt)
    return entries
  }

  /** Read image bytes; null when the id is unknown or unreadable. */
  async readImage(id: string): Promise<{ bytes: Buffer; mime: string } | null> {
    if (!/^[a-f0-9]{8,32}$/.test(id)) return null
    for (const [mime, ext] of Object.entries(IMAGE_MIME_EXT)) {
      try {
        const bytes = await readFile(join(this.imagesDir, `${id}.${ext}`))
        return { bytes, mime }
      } catch {
        /* try next ext */
      }
    }
    return null
  }

  /** Persist image bytes; returns the new id. */
  async saveImage(bytes: Buffer, mime: string): Promise<string> {
    const ext = IMAGE_MIME_EXT[mime]
    if (!ext) throw new Error(`unsupported image type: ${mime}`)
    await this.ensureDirs()
    const id = randomBytes(12).toString('hex')
    await writeFile(join(this.imagesDir, `${id}.${ext}`), bytes)
    return id
  }

  /** Delete an image; false when it did not exist. */
  async deleteImage(id: string): Promise<boolean> {
    if (!/^[a-f0-9]{8,32}$/.test(id)) return false
    for (const ext of Object.values(IMAGE_MIME_EXT)) {
      try {
        await unlink(join(this.imagesDir, `${id}.${ext}`))
        return true
      } catch {
        /* try next ext */
      }
    }
    return false
  }

  /* ------------------------- wallpaper bundles ------------------------- */

  /** Parse one bundle directory into a listing entry (error field carries
   * manifest problems instead of throwing). */
  private async readBundle(id: string): Promise<WallpaperEntry | null> {
    const dir = join(this.wallpapersDir, id)
    let manifest: WallpaperManifest
    try {
      manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as WallpaperManifest
    } catch {
      return { id, name: id, type: 'web', description: '', author: '', entry: '', error: 'manifest.json missing or invalid' }
    }
    const problem =
      manifest.format !== WALLPAPER_FORMAT
        ? `unsupported format: ${String(manifest.format)}`
        : !['video', 'web', 'canvas', 'character'].includes(manifest.type)
          ? `unknown type: ${String(manifest.type)}`
          : typeof manifest.entry !== 'string' || manifest.entry === ''
            ? 'missing entry'
            : undefined
    return {
      id,
      name: manifest.name || id,
      type: manifest.type,
      description: manifest.description ?? '',
      author: manifest.author ?? '',
      entry: manifest.entry,
      error: problem,
    }
  }

  /** List installed wallpaper bundles (sorted by name). */
  async listWallpapers(): Promise<WallpaperEntry[]> {
    let ids: string[]
    try {
      ids = await readdir(this.wallpapersDir)
    } catch {
      return []
    }
    const entries: WallpaperEntry[] = []
    for (const id of ids) {
      try {
        if (!(await stat(join(this.wallpapersDir, id))).isDirectory()) continue
      } catch {
        continue
      }
      const entry = await this.readBundle(id)
      if (entry) entries.push(entry)
    }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    return entries
  }

  /** Read a bundle's manifest; null when unreadable. */
  async readManifest(id: string): Promise<WallpaperManifest | null> {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) return null
    try {
      return JSON.parse(await readFile(join(this.wallpapersDir, id, 'manifest.json'), 'utf8')) as WallpaperManifest
    } catch {
      return null
    }
  }

  /** Import a bundle from a local directory (recursive copy). Returns the
   * new bundle id. Throws with a readable message on bad input. */
  async importWallpaper(fromDir: string): Promise<string> {
    const source = normalize(fromDir)
    let probe: string
    try {
      probe = await readFile(join(source, 'manifest.json'), 'utf8')
    } catch {
      throw new Error('no manifest.json under that directory')
    }
    const manifest = JSON.parse(probe) as WallpaperManifest
    if (manifest.format !== WALLPAPER_FORMAT) {
      throw new Error(`unsupported format: ${String(manifest.format)} (expected ${WALLPAPER_FORMAT})`)
    }
    const id = `wp-${randomBytes(6).toString('hex')}`
    await mkdir(this.wallpapersDir, { recursive: true })
    await cp(source, join(this.wallpapersDir, id), { recursive: true })
    return id
  }

  /** Delete a bundle; false when it did not exist. */
  async deleteWallpaper(id: string): Promise<boolean> {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) return false
    try {
      await rm(join(this.wallpapersDir, id), { recursive: true, force: true })
      return true
    } catch {
      return false
    }
  }

  /** Serve one file from a bundle. Path is validated to stay inside the
   * bundle (no .., no absolute, no drive letters). */
  async readAsset(id: string, relPath: string): Promise<{ bytes: Buffer; mime: string } | null> {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) return null
    if (relPath === '' || relPath.includes('..') || /^[a-zA-Z]:/.test(relPath) || relPath.startsWith('/') || relPath.startsWith('\\')) {
      return null
    }
    const base = normalize(join(this.wallpapersDir, id))
    const target = normalize(join(base, relPath))
    if (!target.startsWith(base)) return null
    try {
      const bytes = await readFile(target)
      return { bytes, mime: ASSET_MIME[extname(target).toLowerCase()] ?? 'application/octet-stream' }
    } catch {
      return null
    }
  }
}
