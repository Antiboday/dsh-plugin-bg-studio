/**
 * HTTP route family for bg-studio, mounted on ctx.webServer.
 *
 *   GET    /api/dsh-bg-studio/settings        → { settings, images }
 *   PUT    /api/dsh-bg-studio/settings        body: partial settings → { settings, images }
 *   POST   /api/dsh-bg-studio/reset           → { settings, images }
 *   POST   /api/dsh-bg-studio/images?name=x   body: raw image bytes → { id }
 *   DELETE /api/dsh-bg-studio/images?id=x     → { ok }
 *   GET    /api/dsh-bg-studio/image?id=x      → image bytes (long cache)
 *
 * Trust fence: loopback only (socket remote address AND Host header), the
 * same shape the official GUI uses for its own local routes. The web UI is
 * same-origin, so the fence never blocks it and never lets a LAN peer in.
 * Each handler checks its own method — webServer matches by path only.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { BgStudioStore } from './store.ts'
import type { ActivityBridge } from './activity.ts'
import { setDebugState } from './activity.ts'
import { IMAGE_MIME_EXT } from '../shared/protocol.ts'

/** One ctx.webServer registration: exact-path match, handler checks method. */
export interface Route {
  kind: 'exact'
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void
}

export const ROUTES = {
  settings: '/api/dsh-bg-studio/settings',
  reset: '/api/dsh-bg-studio/reset',
  images: '/api/dsh-bg-studio/images',
  image: '/api/dsh-bg-studio/image',
  windowMaterial: '/api/dsh-bg-studio/window-material',
  wallpapers: '/api/dsh-bg-studio/wallpapers',
  asset: '/api/dsh-bg-studio/asset',
  activity: '/api/dsh-bg-studio/activity',
  weScan: '/api/dsh-bg-studio/we-scan',
  weImport: '/api/dsh-bg-studio/we-import',
} as const

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
  })
  res.end(text)
}

function isIPv4Loopback(v4: string): boolean {
  const parts = v4.split('.')
  return parts.length === 4 && parts[0] === '127' && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
}

/** Loopback socket + loopback Host header, mirroring the GUI's local fence. */
function isLoopbackRequest(req: IncomingMessage): boolean {
  const remote = req.socket.remoteAddress
  if (remote === undefined) return false
  const norm = remote.toLowerCase()
  const socketOk =
    norm === '::1' ||
    norm.startsWith('::ffff:') && isIPv4Loopback(norm.slice(7)) ||
    isIPv4Loopback(norm)
  if (!socketOk) return false
  try {
    const host = new URL('http://' + (req.headers.host ?? '')).hostname
    return host === 'localhost' || host === '[::1]' || isIPv4Loopback(host)
  } catch {
    return false
  }
}

function guard(req: IncomingMessage, res: ServerResponse, method: string): boolean {
  if (req.method !== method) {
    writeJson(res, 405, { error: `method not allowed (${req.method})` })
    return false
  }
  if (!isLoopbackRequest(req)) {
    writeJson(res, 403, { error: 'loopback only' })
    return false
  }
  return true
}

/** Read the request body as a Buffer, capped at maxBytes. */
function readBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    req.on('data', (chunk: Buffer) => {
      total += chunk.length
      if (total > maxBytes) {
        req.destroy()
        reject(new Error('body too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/** Read a bounded JSON object body; null when absent/invalid/oversized. */
async function readJsonObject(req: IncomingMessage, maxBytes = 256 * 1024): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readBody(req, maxBytes)
    if (raw.length === 0) return null
    const parsed: unknown = JSON.parse(raw.toString('utf8'))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function queryParam(req: IncomingMessage, name: string): string | undefined {
  try {
    const value = new URL(req.url ?? '/', 'http://x').searchParams.get(name)
    return value === null ? undefined : value
  } catch {
    return undefined
  }
}

export interface RouteDeps {
  store: BgStudioStore
  maxImageBytes: number
  logger: { warn: (error: unknown) => void }
  /** Best-effort DWM material for the desktop window (see host index). */
  applyWindowMaterial?: (material: string) => { ok: boolean; detail: string }
  /** Agent-activity bridge for interactive wallpapers. */
  activity?: ActivityBridge
}

async function settingsView(store: BgStudioStore): Promise<{ settings: unknown; images: unknown }> {
  return { settings: await store.loadSettings(), images: await store.listImages() }
}

/** Build every route object for ctx.webServer.register. webServer matches by
 * path only, so each path is ONE handler that dispatches on req.method. */
export function makeRoutes({ store, maxImageBytes, logger, applyWindowMaterial, activity }: RouteDeps): Route[] {
  return [
    {
      kind: 'exact',
      path: ROUTES.settings,
      handler: async (req, res) => {
        try {
          if (req.method === 'GET') {
            writeJson(res, 200, await settingsView(store))
            return
          }
          if (req.method === 'PUT') {
            const patch = await readJsonObject(req)
            if (patch === null) {
              writeJson(res, 400, { error: 'expected a JSON object body' })
              return
            }
            await store.savePatch(patch)
            writeJson(res, 200, await settingsView(store))
            return
          }
          writeJson(res, 405, { error: `method not allowed (${req.method})` })
        } catch (error) {
          logger.warn(error)
          writeJson(res, 500, { error: String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.reset,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        try {
          await store.reset()
          writeJson(res, 200, await settingsView(store))
        } catch (error) {
          logger.warn(error)
          writeJson(res, 500, { error: String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.images,
      handler: async (req, res) => {
        try {
          if (req.method === 'DELETE') {
            const id = queryParam(req, 'id')
            if (!id) {
              writeJson(res, 400, { error: 'expected ?id=<image id>' })
              return
            }
            const ok = await store.deleteImage(id)
            writeJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'unknown image' })
            return
          }
          if (req.method === 'POST') {
            const mime = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
            if (!IMAGE_MIME_EXT[mime]) {
              writeJson(res, 415, { error: `unsupported image type: ${mime || '(none)'}` })
              return
            }
            let bytes: Buffer
            try {
              bytes = await readBody(req, maxImageBytes)
            } catch {
              writeJson(res, 413, { error: 'image too large' })
              return
            }
            if (bytes.length === 0) {
              writeJson(res, 400, { error: 'empty body' })
              return
            }
            const id = await store.saveImage(bytes, mime)
            writeJson(res, 201, { id })
            return
          }
          writeJson(res, 405, { error: `method not allowed (${req.method})` })
        } catch (error) {
          logger.warn(error)
          writeJson(res, 500, { error: String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.windowMaterial,
      handler: async (req, res) => {
        try {
          if (req.method === 'POST') {
            const body = await readJsonObject(req, 4 * 1024)
            const material = body?.material
            if (typeof material !== 'string' || !['acrylic', 'mica', 'none'].includes(material)) {
              writeJson(res, 400, { error: "expected {material: 'acrylic'|'mica'|'none'}" })
              return
            }
            if (!applyWindowMaterial) {
              writeJson(res, 200, { ok: false, detail: 'electron-unavailable' })
              return
            }
            writeJson(res, 200, applyWindowMaterial(material))
            return
          }
          writeJson(res, 405, { error: `method not allowed (${req.method})` })
        } catch (error) {
          logger.warn(error)
          writeJson(res, 500, { error: String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.wallpapers,
      handler: async (req, res) => {
        try {
          if (req.method === 'GET') {
            writeJson(res, 200, { wallpapers: await store.listWallpapers() })
            return
          }
          if (req.method === 'POST') {
            const dir = queryParam(req, 'dir')
            if (!dir) {
              writeJson(res, 400, { error: 'expected ?dir=<absolute bundle directory>' })
              return
            }
            try {
              const id = await store.importWallpaper(dir)
              writeJson(res, 201, { id })
            } catch (error) {
              writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
            }
            return
          }
          if (req.method === 'DELETE') {
            const id = queryParam(req, 'id')
            if (!id) {
              writeJson(res, 400, { error: 'expected ?id=<bundle id>' })
              return
            }
            const ok = await store.deleteWallpaper(id)
            writeJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'unknown bundle' })
            return
          }
          writeJson(res, 405, { error: `method not allowed (${req.method})` })
        } catch (error) {
          logger.warn(error)
          writeJson(res, 500, { error: String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.asset,
      handler: async (req, res) => {
        try {
          if (req.method !== 'GET') {
            writeJson(res, 405, { error: `method not allowed (${req.method})` })
            return
          }
          const id = queryParam(req, 'id')
          const path = queryParam(req, 'path') ?? ''
          if (!id) {
            writeJson(res, 400, { error: 'expected ?id=<bundle id>&path=<file>' })
            return
          }
          const found = await store.readAsset(id, path)
          if (!found) {
            writeJson(res, 404, { error: 'asset not found' })
            return
          }
          res.writeHead(200, {
            'content-type': found.mime,
            'content-length': found.bytes.length,
            // Bundle ids are random and bundles are immutable once imported.
            'cache-control': 'public, max-age=86400',
          })
          res.end(found.bytes)
        } catch (error) {
          logger.warn(error)
          writeJson(res, 500, { error: String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.activity,
      handler: async (req, res) => {
        try {
          if (req.method !== 'GET') {
            writeJson(res, 405, { error: `method not allowed (${req.method})` })
            return
          }
          if (!activity) {
            writeJson(res, 200, { activeTasks: 0, state: 'idle' })
            return
          }
          // Test hook: ?debugState=idle|busy|overloaded (or none to clear).
          const debug = queryParam(req, 'debugState')
          if (debug !== undefined) {
            if (debug === '' || debug === 'none') setDebugState(null)
            else if (debug === 'idle' || debug === 'busy' || debug === 'overloaded') setDebugState(debug)
          }
          const threshold = Number(queryParam(req, 'threshold') ?? 3)
          writeJson(res, 200, activity.snapshot(Number.isFinite(threshold) ? Math.max(1, threshold) : 3))
        } catch (error) {
          logger.warn(error)
          writeJson(res, 500, { error: String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.weScan,
      handler: async (req, res) => {
        try {
          if (req.method !== 'GET') {
            writeJson(res, 405, { error: `method not allowed (${req.method})` })
            return
          }
          const root = queryParam(req, 'root')
          if (!root) {
            writeJson(res, 400, { error: 'expected ?root=<workshop content dir>' })
            return
          }
          writeJson(res, 200, { items: await store.scanWorkshop(root) })
        } catch (error) {
          logger.warn(error)
          writeJson(res, 500, { error: String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.weImport,
      handler: async (req, res) => {
        try {
          if (req.method !== 'POST') {
            writeJson(res, 405, { error: `method not allowed (${req.method})` })
            return
          }
          const root = queryParam(req, 'root')
          const wid = queryParam(req, 'id')
          if (!root || !wid) {
            writeJson(res, 400, { error: 'expected ?root=<dir>&id=<workshop id>' })
            return
          }
          try {
            const id = await store.importFromWorkshop(root, wid)
            writeJson(res, 201, { id })
          } catch (error) {
            writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
          }
        } catch (error) {
          logger.warn(error)
          writeJson(res, 500, { error: String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.image,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        try {
          const id = queryParam(req, 'id')
          if (!id) {
            writeJson(res, 400, { error: 'expected ?id=<image id>' })
            return
          }
          const found = await store.readImage(id)
          if (!found) {
            writeJson(res, 404, { error: 'unknown image' })
            return
          }
          res.writeHead(200, {
            'content-type': found.mime,
            'content-length': found.bytes.length,
            // ids are random and immutable — safe to cache hard.
            'cache-control': 'public, max-age=31536000, immutable',
          })
          res.end(found.bytes)
        } catch (error) {
          logger.warn(error)
          writeJson(res, 500, { error: String(error) })
        }
      },
    },
  ]
}
