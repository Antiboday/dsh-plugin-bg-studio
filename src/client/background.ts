/**
 * The background layer: one fixed div under all app content, plus the
 * provider registry that renders each mode into it.
 *
 * EXTENSION POINT — animated wallpapers. A future mode is exactly one new
 * provider module plus one entry in PROVIDERS below; nothing else changes:
 *
 *   export const animatedProvider: BackgroundProvider = {
 *     mount(el, settings, ctx) { /* <video>/<canvas>/… el is yours *\/ },
 *     update(el, settings) { /* param tweaks without remount *\/ },
 *     dispose(el) { /* release elements, loops, media *\/ },
 *   }
 *
 * Providers own their DOM inside the layer; the layer itself is owned here.
 * All of it sits under pointer-events:none so the UI keeps every click.
 */
import type { BgStudioSettings } from '../shared/protocol.ts'
import { imageProvider } from './providers/image.ts'
import { transparentProvider } from './providers/transparent.ts'
import { frostedProvider } from './providers/frosted.ts'
import { animatedProvider } from './providers/animated.ts'

/** What providers may need from the host page. */
export interface ProviderContext {
  /** Same-origin URL serving a library image by id. */
  imageUrl(id: string): string
  /** Same-origin URL serving one file inside a wallpaper bundle. */
  assetUrl(bundleId: string, path: string): string
  /** Same-origin URL serving a bundle's manifest.json. */
  manifestUrl(bundleId: string): string
  /** Current DSH dark-scheme decision. */
  isDark(): boolean
  /** Subscribe to dark/light flips; returns the unsubscribe function. */
  onSchemeChange(callback: () => void): () => void
  /** Persist "never ask the theme-mood question for this bundle". */
  muteMoodPrompt(bundleId: string): void
}

/** One background mode implementation. mount runs on mode entry; update
 * re-renders parameters WITHOUT remounting (animated content must not
 * restart on slider drags); dispose releases everything on mode exit. */
export interface BackgroundProvider {
  mount(el: HTMLElement, settings: BgStudioSettings, ctx: ProviderContext): void
  update?(el: HTMLElement, settings: BgStudioSettings, ctx: ProviderContext): void
  dispose?(el: HTMLElement): void
}

const PROVIDERS: Record<string, BackgroundProvider> = {
  image: imageProvider,
  transparent: transparentProvider,
  frosted: frostedProvider,
  animated: animatedProvider,
}

const LAYER_ID = 'dsh-bg-studio-layer'

export class BackgroundLayer {
  private el: HTMLDivElement | null = null
  private activeKind: string | null = null

  private ensureLayer(): HTMLDivElement {
    if (this.el && this.el.isConnected) return this.el
    const el = document.createElement('div')
    el.id = LAYER_ID
    el.className = 'dsh-bg-studio-layer'
    // First child of body: everything else paints above the layer.
    document.body.insertBefore(el, document.body.firstChild)
    this.el = el
    return el
  }

  /** Switch mode / refresh parameters. Cheap: same-kind updates call
   * provider.update instead of remounting (future animated content must not
   * restart on slider drags). */
  setSettings(settings: BgStudioSettings, ctx: ProviderContext): void {
    if (typeof document === 'undefined') return
    if (settings.kind === 'none') {
      this.dispose()
      return
    }
    const el = this.ensureLayer()
    const provider = PROVIDERS[settings.kind]
    if (!provider) return
    if (this.activeKind === settings.kind) {
      provider.update?.(el, settings, ctx)
      return
    }
    if (this.activeKind !== null) {
      PROVIDERS[this.activeKind]?.dispose?.(el)
      el.replaceChildren()
    }
    this.activeKind = settings.kind
    try {
      provider.mount(el, settings, ctx)
    } catch {
      // A broken provider must degrade to "no background", never break UI.
      el.replaceChildren()
      this.activeKind = null
    }
  }

  dispose(): void {
    if (this.el) {
      if (this.activeKind !== null) {
        try {
          PROVIDERS[this.activeKind]?.dispose?.(this.el)
        } catch {
          /* already tearing down */
        }
      }
      this.el.remove()
      this.el = null
    }
    this.activeKind = null
  }
}
