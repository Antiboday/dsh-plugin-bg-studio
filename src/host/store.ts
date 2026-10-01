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
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile, cp, rm, open } from 'node:fs/promises'
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

/** Loose mime map for bundle assets (fall back to octet-stream). */const ASSET_MIME: Record<string, string> = {
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

/**
 * Rewrite an HTML entry for serving through the query-style asset route:
 *
 *  1. Relative src/href/url() references would resolve against the route's
 *     directory (/api/dsh-bg-studio/) and lose the bundle id — rewrite them
 *     into absolute asset URLs.
 *  2. Inject a transparent-document base style (an unstyled web wallpaper
 *     otherwise paints a hard white page) and a no-op Wallpaper Engine API
 *     shim, so WE-authored pages that call wallpaperRegister* at init don't
 *     crash before painting.
 */
const WE_SHIM = [
  '<script>',
  '(function(){var n=function(){};',
  'window.wallpaperRegister=n;window.wallpaperRegisterAudioListener=n;',
  'window.wallpaperRequestRandomFileForProperty=n;window.wallpaperRequestFileForProperty=n;',
  'window.wallpaperPropertyListener=null;',
  'window.addEventListener("message",function(ev){var d=ev.data||{};',
  'if(d.source==="dsh-bg-studio"&&typeof window.wallpaperPropertyListener==="function")',
  'window.wallpaperPropertyListener({name:"dshActivity",value:d});});',
  '})();</script>',
  '<style>html{background:transparent}</style>',
].join('')

function rewriteHtmlForServing(bundleId: string, html: string): string {
  const toAbsolute = (raw: string): string => {
    if (raw === '' || /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|\/|#|data:)/.test(raw)) return raw
    const cleaned = raw.split('#')[0].split('?')[0]
    if (cleaned === '') return raw
    return `/api/dsh-bg-studio/asset?id=${encodeURIComponent(bundleId)}&path=${encodeURIComponent(cleaned)}`
  }
  let out = html.replace(/(\s(?:src|href)\s*=\s*)(["'])([^"']*)\2/gi, (m, attr, q, url) => `${attr}${q}${toAbsolute(url)}${q}`)
  out = out.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, url) => `url(${q}${toAbsolute(url)}${q})`)
  const injection = WE_SHIM
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => `${m}${injection}`)
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (m) => `${m}${injection}`)
  } else {
    out = injection + out
  }
  return out
}

export class BgStudioStore {  constructor(private readonly dataDir: string) {}

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
    return this.readAssetRange(id, relPath, undefined, undefined)
  }

  /** Range-aware variant for media streaming: `start`/`end` are inclusive
   * byte offsets; both undefined means the whole file. Returns the slice,
   * the mime, and the total size for Content-Range headers. */
  async readAssetRange(id: string, relPath: string, start?: number, end?: number): Promise<{ bytes: Buffer; mime: string; total: number } | null> {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) return null
    if (relPath === '' || relPath.includes('..') || /^[a-zA-Z]:/.test(relPath) || relPath.startsWith('/') || relPath.startsWith('\\')) {
      return null
    }
    const base = normalize(join(this.wallpapersDir, id))
    const target = normalize(join(base, relPath))
    if (!target.startsWith(base)) return null
    try {
      const { size } = await stat(target)
      const mime = ASSET_MIME[extname(target).toLowerCase()] ?? 'application/octet-stream'
      if (mime.startsWith('text/html')) {
        // Serve web-bundle entries rewritten for the query-style asset route.
        const rewritten = rewriteHtmlForServing(id, (await readFile(target)).toString('utf8'))
        const bytes = Buffer.from(rewritten, 'utf8')
        return { bytes, mime, total: bytes.length }
      }
      if (start === undefined && end === undefined) {
        return { bytes: await readFile(target), mime, total: size }
      }
      const from = Math.max(0, Math.min(start ?? 0, size - 1))
      const to = Math.max(from, Math.min(end ?? size - 1, size - 1))
      const length = to - from + 1
      const handle = await open(target, 'r')
      try {
        const bytes = Buffer.alloc(length)
        await handle.read(bytes, 0, length, from)
        return { bytes, mime, total: size }
      } finally {
        await handle.close()
      }
    } catch {
      return null
    }
  }

  /* --------------------- Wallpaper Engine workshop --------------------- */

  /** Scan a WE workshop content directory; returns one row per wallpaper
   * with a convertibility verdict. Read-only. */
  async scanWorkshop(root: string): Promise<Array<{ id: string; title: string; type: string; file: string; convertible: boolean; reason?: string }>> {
    const items: Array<{ id: string; title: string; type: string; file: string; convertible: boolean; reason?: string }> = []
    let entries: string[]
    try {
      entries = await readdir(root)
    } catch {
      return items
    }
    for (const wid of entries) {
      if (!/^\d+$/.test(wid)) continue
      try {
        const project = JSON.parse(await readFile(join(root, wid, 'project.json'), 'utf8')) as Record<string, unknown>
        const type = String(project.type ?? '').toLowerCase()
        const file = String(project.file ?? '')
        const title = String(project.title ?? wid)
        const convertible = (type === 'video' || type === 'web') && file !== ''
        items.push({
          id: wid,
          title,
          type,
          file,
          convertible,
          reason: convertible ? undefined : type === 'video' || type === 'web' ? '入口文件缺失' : 'WE 专属场景格式，暂不支持',
        })
      } catch {
        items.push({ id: wid, title: wid, type: '?', file: '', convertible: false, reason: 'project.json 缺失或损坏' })
      }
    }
    items.sort((a, b) => a.title.localeCompare(b.title))
    return items
  }

  /** Convert one WE workshop wallpaper into a library bundle WITHOUT writing
   * anything into the workshop directory: the converted manifest and the
   * needed assets are copied into our storage. Video bundles copy just the
   * movie file; web bundles copy everything except WE metadata/previews.
   * Returns the new bundle id. */
  async importFromWorkshop(root: string, wid: string): Promise<string> {
    if (!/^\d+$/.test(wid)) throw new Error('bad workshop id')
    const source = normalize(join(root, wid))
    const project = JSON.parse(await readFile(join(source, 'project.json'), 'utf8')) as Record<string, unknown>
    const type = String(project.type ?? '').toLowerCase()
    const entry = String(project.file ?? '')
    if (!((type === 'video' || type === 'web') && entry)) {
      throw new Error(`该壁纸类型（${type || '?'}）暂不支持转换`)
    }
    const id = `wp-${randomBytes(6).toString('hex')}`
    const dest = join(this.wallpapersDir, id)
    await mkdir(dest, { recursive: true })
    const manifest: WallpaperManifest = {
      format: WALLPAPER_FORMAT,
      name: String(project.title ?? wid),
      description: `Imported from Wallpaper Engine workshop ${wid}`,
      author: String(project.author || 'workshop'),
      type: type as 'video' | 'web',
      entry,
    }
    await writeFile(join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
    if (type === 'video') {
      await cp(join(source, entry), join(dest, entry))
    } else {
      // Web bundles reference sibling assets; copy all, minus WE metadata.
      for (const name of await readdir(source)) {
        if (name === 'project.json' || /^preview\.(gif|jpg|png|webp)$/i.test(name)) continue
        await cp(join(source, name), join(dest, name), { recursive: true })
      }
    }
    return id
  }
}
