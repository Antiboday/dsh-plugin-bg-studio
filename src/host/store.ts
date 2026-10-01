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
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import {
  DEFAULT_SETTINGS,
  IMAGE_MIME_EXT,
  applySettingsPatch,
  sanitizeSettings,
  type BgStudioSettings,
  type ImageEntry,
} from '../shared/protocol.ts'

export class BgStudioStore {
  constructor(private readonly dataDir: string) {}

  private get settingsPath(): string {
    return join(this.dataDir, 'settings.json')
  }

  private get imagesDir(): string {
    return join(this.dataDir, 'images')
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
}
