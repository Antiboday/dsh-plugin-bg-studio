/**
 * Browser-half entry for dsh-plugin-bg-studio — runs inside the DSH web GUI.
 *
 * Owns one runtime (settings + background layer + surface style) and mounts
 * the settings panel as a native center-column page: a row in the shell's
 * sidebar panel list plus a keyed `main` page, both through official slot
 * seats. Failure policy follows the skill-explorer precedent: registration
 * problems are logged, never thrown — an external plugin must not take the
 * GUI down.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the ctx.slots merge (renderer owns the slot registry).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the ctx.locale merge (locale service dictionaries).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { BgStudioRuntime } from './runtime.ts'
import { PanelPage } from './panel/PanelPage.tsx'
import { PanelIcon } from './panel/PanelIcon.tsx'
import { BG_STUDIO_PANEL_ID } from './ids.ts'
import { startTurnWave } from './turnwave/index.ts'
import { en, zh, setTranslator, tt } from './locales.ts'

/** Locale namespace this plugin owns. */
const NS = 'dsh-bg-studio'

/** Row order among the shell's global panel rows (Plugins 0, Schedule 10, board 20…). */
const PANEL_ORDER = 40

/** Required services (fiber inject waiting — the runtime must be up first). */
export const inject = ['slots', 'layout', 'locale']

export function apply(ctx: ClientContext): void {
  // Register our dictionaries with the app's locale service and route every
  // tt() call through it — copy then follows the DSH Language setting at
  // call time (no reload needed). Falls back to the browser language when
  // the service is unavailable.
  try {
    const locale = (ctx as unknown as { locale?: { register(ns: string, dicts: Record<string, Record<string, string>>): void; bind(ns: string): (key: string) => string } }).locale
    locale?.register(NS, { zh, en })
    if (locale) setTranslator(locale.bind(NS))
  } catch (error) {
    console.warn('[bg-studio] locale registration failed:', error)
  }

  const disposers: Array<() => void> = []
  const runtime = new BgStudioRuntime()
  void runtime.start()

  // Turn-navigator music wave (merged from dsh-plugin-pulse-divider): rides
  // the audio DSH itself plays; stays fully idle on hosts without the
  // official navigator.
  try {
    disposers.push(startTurnWave())
  } catch (error) {
    console.warn('[bg-studio:turnwave] failed to start:', error)
  }
  try {
    const slots = ctx.slots as unknown as {
      inject(key: string, callback: () => () => void): () => void
      register(options: Record<string, unknown>, component: unknown): () => void
    }
    disposers.push(slots.inject('sidebar.panellist', () => slots.register({
      name: 'sidebar.panellist',
      id: BG_STUDIO_PANEL_ID,
      order: PANEL_ORDER,
      label: () => tt('panel.entry'),
    }, PanelIcon)))

    disposers.push(slots.inject('main', () => slots.register({
      name: 'main',
      key: BG_STUDIO_PANEL_ID,
      inject: (): { runtime: BgStudioRuntime } => ({ runtime }),
    }, PanelPage as never)))
  } catch (error) {
    // Registration failures degrade the panel, never the GUI.
    console.warn('[bg-studio] panel registration failed:', error)
  }

  ctx.effect(() => () => {
    for (const dispose of disposers.splice(0)) dispose()
    runtime.dispose()
  }, 'bg-studio: runtime')
}
