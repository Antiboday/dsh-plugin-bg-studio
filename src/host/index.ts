/**
 * Host entry for dsh-plugin-bg-studio.
 *
 * Responsibilities are deliberately tiny: own a storage directory, expose the
// route family on the webServer service, and stay out of the way otherwise.
 * All rendering decisions live in the web client; all persistence lives in
 * the store. Failure policy: registration problems are logged and the plugin
 * stays silent — a background customizer must never take the harness down.
 */
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import { join, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { BgStudioStore } from './store.ts'
import { makeRoutes, type Route } from './routes.ts'
import { mountActivityBridge } from './activity.ts'

export const name = 'bgStudio'

export const inject = ['webServer']

export interface Config {
  enabled: boolean
  /** Storage root override; default $DSH_HOME or ~/.dsh. */
  dshHome: string
  /** Upload cap per image, in MiB. */
  maxImageMiB: number
}

export const Config: Schema<Config> = Schema.object({
  enabled: Schema.boolean().default(true),
  dshHome: Schema.string().default(''),
  maxImageMiB: Schema.number().default(20),
})

/**
 * Best-effort native window material for the DESKTOP app's transparent mode.
 *
 * Why: the Windows main window is not created with `transparent: true` (a
 * constructor-only flag), so cleared CSS surfaces can only reveal the window
 * color. On Windows 11, though, `BrowserWindow.setBackgroundMaterial()`
 * swaps that opaque backing for a DWM system material (acrylic/mica) at
 * runtime. That API only exists when this host code runs inside the Electron
 * main process — under `dsh web` / CLI profiles require('electron') yields
 * nothing usable, and the probe stays null. Every step degrades silently:
 * wrong OS, missing API, or destroyed windows just report unavailable.
 */
interface MaterialWindow {
  getAllWindows(): Array<{
    isDestroyed(): boolean
    getBounds(): { width: number; height: number }
    setBackgroundMaterial(material: string): void
  }>
}
let electronWindows: MaterialWindow | null = null
try {
  const require = createRequire(import.meta.url)
  const electron = require('electron') as { BrowserWindow?: MaterialWindow }
  if (electron && typeof electron.BrowserWindow?.getAllWindows === 'function') {
    electronWindows = electron.BrowserWindow
  }
} catch {
  /* not running inside Electron (web/CLI profiles) — feature off */
}

/** The primary (largest live) window, or null. */
function primaryWindow(): ReturnType<MaterialWindow['getAllWindows']>[number] | null {
  if (!electronWindows) return null
  const alive = electronWindows.getAllWindows().filter((w) => !w.isDestroyed())
  if (alive.length === 0) return null
  return alive.reduce((a, b) => (b.getBounds().width * b.getBounds().height > a.getBounds().width * a.getBounds().height ? b : a))
}

/** Apply a DWM material ('acrylic' | 'mica' | 'none') to the main window.
 *
 * Platform split: the official macOS build already creates its window with
 * vibrancy + a transparent backing, so transparent mode needs NO call at all
 * there — and setBackgroundMaterial is a Windows-only Electron API anyway.
 * Reporting ok on darwin keeps the panel's status line truthful. */
export function applyWindowMaterial(material: string): { ok: boolean; detail: string } {
  if (process.platform === 'darwin') {
    return { ok: true, detail: 'darwin-vibrancy-builtin' }
  }
  if (!electronWindows) return { ok: false, detail: 'electron-unavailable' }
  const win = primaryWindow()
  if (!win) return { ok: false, detail: 'no-window' }
  try {
    win.setBackgroundMaterial(material)
    return { ok: true, detail: material }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) }
  }
}

export function apply(ctx: Context, config: Config): void {
  if (config?.enabled === false) return
  try {
    const dshHome =
      config.dshHome?.trim() !== ''
        ? config.dshHome
        : process.env.DSH_HOME ?? join(homedir(), '.dsh')
    const store = new BgStudioStore(join(dshHome, sep, 'storages', 'dsh-plugin-bg-studio'))
    const routes: Route[] = makeRoutes({
      store,
      maxImageBytes: Math.max(1, config.maxImageMiB) * 1024 * 1024,
      logger: { warn: (error) => ctx.logger.warn(error) },
      applyWindowMaterial,
      activity: mountActivityBridge(ctx),
    })
    ctx.effect(() => {
      const disposers = routes.map((route) => ctx.webServer.register(route))
      return () => {
        for (const dispose of disposers) dispose()
      }
    }, 'bg-studio: routes')
  } catch (error) {
    // Never fail boot over a background customizer.
    ctx.logger.warn(`[bg-studio] host apply degraded: ${error instanceof Error ? error.message : String(error)}`)
  }
}
