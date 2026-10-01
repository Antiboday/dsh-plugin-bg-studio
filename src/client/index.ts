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
import { BgStudioRuntime } from './runtime.ts'
import { PanelPage } from './panel/PanelPage.tsx'
import { PanelIcon } from './panel/PanelIcon.tsx'
import { BG_STUDIO_PANEL_ID } from './ids.ts'

/** Row order among the shell's global panel rows (Plugins 0, Schedule 10, board 20…). */
const PANEL_ORDER = 40

/** Required services (fiber inject waiting — the runtime must be up first). */
export const inject = ['slots', 'layout']

export function apply(ctx: ClientContext): void {
  const runtime = new BgStudioRuntime()
  void runtime.start()

  const disposers: Array<() => void> = []
  try {
    const slots = ctx.slots as unknown as {
      inject(key: string, callback: () => () => void): () => void
      register(options: Record<string, unknown>, component: unknown): () => void
    }
    disposers.push(slots.inject('sidebar.panellist', () => slots.register({
      name: 'sidebar.panellist',
      id: BG_STUDIO_PANEL_ID,
      order: PANEL_ORDER,
      label: () => (navigator.language?.toLowerCase().startsWith('zh') ? '背景' : 'Background'),
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
