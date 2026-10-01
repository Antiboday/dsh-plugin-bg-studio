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
import { join, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { BgStudioStore } from './store.ts'
import { makeRoutes, type Route } from './routes.ts'

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
