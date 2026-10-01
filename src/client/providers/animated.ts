/**
 * Animated wallpaper provider — the orchestrator for the bundle family.
 *
 * Responsibilities: load the active bundle's manifest, pick the renderer for
 * its type, and (for the interactive types) run the activity machine and
 * forward its state to the renderer. The four renderers themselves are dumb;
 * all policy lives here. Adding a bundle type = one renderer in renderers.ts
 * plus one line in RENDERERS.
 */
import type { BgStudioSettings, WallpaperManifest } from '../../shared/protocol.ts'
import type { BackgroundProvider, ProviderContext } from '../background.ts'
import { ActivityMachine } from '../activity.ts'
import { canvasRenderer, characterRenderer, videoRenderer, webRenderer, type RendererCtx, type WallpaperRenderer } from '../renderers.ts'

const RENDERERS: Record<string, WallpaperRenderer> = {
  video: videoRenderer,
  web: webRenderer,
  canvas: canvasRenderer,
  character: characterRenderer,
}

/** Module-level: one activity machine per page, shared across remounts. */
const activity = new ActivityMachine()

interface AnimatedDom {
  manifest: WallpaperManifest | null
  renderer: WallpaperRenderer | null
}

export const animatedProvider: BackgroundProvider = {
  mount(el, settings, pageCtx) {
    el.replaceChildren()
    const dom: AnimatedDom = { manifest: null, renderer: null }
    ;(el as HTMLElement & { __bgStudioAnim?: AnimatedDom }).__bgStudioAnim = dom

    const ctx: RendererCtx = {
      assetUrl: (path: string) => pageCtx.assetUrl(settings.animated.mediaSource ?? '', path),
      isDark: pageCtx.isDark,
    }
    // Fetch manifest, then dispatch. A bad bundle leaves a dark layer and
    // the panel's error listing explains why — never a thrown error.
    void fetchManifest(settings, pageCtx)
      .then((manifest) => {
        if (!manifest) return
        dom.manifest = manifest
        dom.renderer = RENDERERS[manifest.type]
        if (!dom.renderer) return
        dom.renderer.mount(el, manifest, ctx)
        if (manifest.type === 'character' || manifest.type === 'web') {
          const clips = manifest.states?.idle ?? []
          activity.configure({
            threshold: settings.animated.taskThreshold,
            idleClips: clips,
            idleRotateSec: settings.animated.idleRotateSec,
          })
          activity.onChange((snap) => {
            const clip = snap.state === 'idle'
              ? activity.currentIdleClip
              : (manifest.states?.[snap.state] ?? [])[0] ?? ''
            dom.renderer?.setState?.(el, snap.state, clip)
          })
          activity.start(settings.animated.taskThreshold)
          // Initial paint with the current state.
          const clip = activity.state === 'idle'
            ? activity.currentIdleClip || clips[0] || ''
            : (manifest.states?.[activity.state] ?? [])[0] ?? ''
          dom.renderer.setState?.(el, activity.state, clip)
        }
      })
      .catch(() => { /* network/manifest errors degrade to dark layer */ })
  },

  update(el, settings, pageCtx) {
    // Re-run the full pipeline: bundle or threshold may have changed. The
    // renderers' own update path is the same remount, keeping semantics
    // uniform (animated content restarts on bundle swap only, which is the
    // only case that reaches here with a different mediaSource).
    this.mount?.(el, settings, pageCtx)
  },

  dispose(el) {
    const dom = (el as HTMLElement & { __bgStudioAnim?: AnimatedDom }).__bgStudioAnim
    dom?.renderer?.dispose?.(el)
    activity.stop()
  },
}

/** Load the active bundle's manifest (bundled with a tiny in-memory cache
 * keyed by bundle id, since panels re-mount often). */
const manifestCache = new Map<string, { manifest: WallpaperManifest; at: number }>()

function fetchManifest(settings: BgStudioSettings, pageCtx: ProviderContext): Promise<WallpaperManifest | null> {
  const id = settings.animated.mediaSource
  if (!id) return Promise.resolve(null)
  const cached = manifestCache.get(id)
  if (cached && Date.now() - cached.at < 60_000) return Promise.resolve(cached.manifest)
  return fetch(pageCtx.manifestUrl(id))
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
    .then((manifest: WallpaperManifest) => {
      manifestCache.set(id, { manifest, at: Date.now() })
      return manifest
    })
    .catch(() => null)
}
