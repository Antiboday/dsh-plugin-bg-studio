/**
 * Renderers for the four wallpaper-bundle types. Each renderer owns its DOM
 * inside the background layer element and understands three calls:
 * mount / update (parameter refresh) / setState (activity machine) / dispose.
 * Renderers must tolerate being mounted into a cleared element and must
 * never throw across dispose.
 */
import type { ActivitySnapshot, BundleSettings, MascotSpec, WallpaperManifest } from '../shared/protocol.ts'
import { CANVAS_SCENES } from './scenes.ts'

export type ActivityState = ActivitySnapshot['state']

export interface RendererCtx {
  /** URL for a file inside the active bundle. */
  assetUrl(path: string): string
  isDark(): boolean
  /** This bundle's own settings (the ⚙ panel values). */
  bundle: BundleSettings
}

export interface WallpaperRenderer {
  mount(el: HTMLElement, manifest: WallpaperManifest, ctx: RendererCtx): void
  update?(el: HTMLElement, manifest: WallpaperManifest, ctx: RendererCtx): void
  setState?(el: HTMLElement, state: ActivityState, clip: string): void
  dispose?(el: HTMLElement): void
}

/* ------------------------------- video ------------------------------- */

export const videoRenderer: WallpaperRenderer = {
  mount(el, manifest, ctx) {
    el.replaceChildren()
    const video = document.createElement('video')
    video.src = ctx.assetUrl(manifest.entry)
    video.loop = true
    video.autoplay = true
    video.setAttribute('playsinline', '')
    video.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block'
    video.addEventListener('error', () => { /* keep the element; host logs 404s */ })
    el.append(video)
    // Keep wanting the bundle's volume across remounts (autoplay policy may
    // reject audible playback until a user gesture — see update()).
    ;(video as HTMLVideoElement & { __wantVolume?: number }).__wantVolume = ctx.bundle.volume
    this.update?.(el, manifest, ctx)
  },
  update(el, _manifest, ctx) {
    const video = el.querySelector('video') as (HTMLVideoElement & { __wantVolume?: number; __gestureHook?: () => void }) | null
    if (!video) return
    // Hot-apply the wallpaper-local dials without remounting.
    video.playbackRate = ctx.bundle.rate
    video.style.objectFit = ctx.bundle.fit
    const want = ctx.bundle.volume
    video.__wantVolume = want
    video.volume = want
    video.muted = want === 0
    void video.play().catch(() => {
      // Audible autoplay was rejected (desktop autoplay policy). Degrade to
      // muted so the wallpaper keeps painting, then restore sound on the
      // first user gesture anywhere in the app.
      video.muted = true
      void video.play().catch(() => { /* give up silently */ })
      if (!video.__gestureHook) {
        video.__gestureHook = () => {
          video.volume = video.__wantVolume ?? 0
          video.muted = (video.__wantVolume ?? 0) === 0
          void video.play().catch(() => { /* still denied: stay muted */ })
        }
        window.addEventListener('pointerdown', video.__gestureHook, { once: true })
        window.addEventListener('keydown', video.__gestureHook, { once: true })
      }
    })
  },
}

/* -------------------------------- web -------------------------------- */

export const webRenderer: WallpaperRenderer = {
  mount(el, manifest, ctx) {
    el.replaceChildren()
    const frame = document.createElement('iframe')
    frame.src = ctx.assetUrl(manifest.entry)
    // Sandboxed: scripts run, but the frame gets no same-origin access to
    // the app. Communication is postMessage-only (setState below). The
    // element carries a theme-matched base so an unstyled page never paints
    // hard white over a dark UI (the served HTML also gets a transparent-
    // document style + WE API shim injected host-side).
    frame.setAttribute('sandbox', 'allow-scripts allow-pointer-lock')
    frame.style.cssText = `width:100%;height:100%;border:0;display:block;background:${ctx.isDark() ? '#101318' : '#f2f4f8'}`
    el.append(frame)
  },
  setState(el, state, clip) {
    // The Web-Wallpaper-Engine-style contract: state pushes go to every
    // iframe we own, and the page-side script opts in via message events.
    for (const frame of el.querySelectorAll('iframe')) {
      try {
        frame.contentWindow?.postMessage({ source: 'dsh-bg-studio', type: 'activity', state, idleClip: clip }, '*')
      } catch {
        /* frame not ready or gone */
      }
    }
  },
}

/* ------------------------------- canvas ------------------------------ */

export const canvasRenderer: WallpaperRenderer = {
  mount(el, manifest) {
    el.replaceChildren()
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'width:100%;height:100%;display:block'
    el.append(canvas)
    const ctx2d = canvas.getContext('2d')
    const sceneName = manifest.entry.replace(/^scene:/, '')
    const scene = CANVAS_SCENES[sceneName]
    if (!ctx2d || !scene) return
    const state = { raf: 0, start: performance.now() }
    const draw = (): void => {
      const rect = el.getBoundingClientRect()
      if (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height)) {
        canvas.width = Math.max(1, Math.round(rect.width))
        canvas.height = Math.max(1, Math.round(rect.height))
      }
      scene.frame(ctx2d, canvas.width, canvas.height, (performance.now() - state.start) / 1000)
      state.raf = requestAnimationFrame(draw)
    }
    draw()
    ;(el as HTMLElement & { __bgStudioRaf?: number }).__bgStudioRaf = state.raf
    const stop = (): void => cancelAnimationFrame(state.raf)
    ;(el as HTMLElement & { __bgStudioStop?: () => void }).__bgStudioStop = stop
  },
  dispose(el) {
    ;(el as HTMLElement & { __bgStudioStop?: () => void }).__bgStudioStop?.()
  },
}

/* ----------------------------- character ----------------------------- */

interface CharacterDom {
  canvas: HTMLCanvasElement
  ctx2d: CanvasRenderingContext2D
  image: HTMLImageElement
  spec: MascotSpec
  clip: string
  frameIndex: number
  lastFrameAt: number
  raf: number
  ready: boolean
}

export const characterRenderer: WallpaperRenderer = {
  mount(el, manifest, ctx) {
    el.replaceChildren()
    const dom: CharacterDom = {
      canvas: document.createElement('canvas'),
      ctx2d: null as unknown as CanvasRenderingContext2D,
      image: new Image(),
      spec: { sheet: '', frameW: 128, frameH: 128, fps: 12, clips: {} },
      clip: '',
      frameIndex: 0,
      lastFrameAt: 0,
      raf: 0,
      ready: false,
    }
    dom.canvas.style.cssText = 'width:100%;height:100%;display:block'
    dom.ctx2d = dom.canvas.getContext('2d') as CanvasRenderingContext2D
    el.append(dom.canvas)
    ;(el as HTMLElement & { __bgStudioChar?: CharacterDom }).__bgStudioChar = dom

    // entry = mascot.json path; sibling assets resolve through assetUrl.
    void fetch(ctx.assetUrl(manifest.entry))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`mascot.json ${res.status}`))))
      .then((spec: MascotSpec) => {
        if (!dom.canvas.isConnected) return // mode switched away meanwhile
        dom.spec = spec
        dom.image.src = ctx.assetUrl(spec.sheet)
        void dom.image.decode().catch(() => { /* draw loop retries via complete check */ })
        dom.ready = true
        drawCharacter(el, 0)
      })
      .catch(() => { /* bad bundle: canvas stays dark; error listed in panel */ })
  },
  setState(el, _state, clip) {
    const dom = (el as HTMLElement & { __bgStudioChar?: CharacterDom }).__bgStudioChar
    if (!dom || !dom.ready || !dom.spec.clips[clip] || dom.clip === clip) return
    dom.clip = clip
    dom.frameIndex = 0
  },
  update(el, manifest, ctx) {
    // Parameter refreshes re-mount (bundle or entry changed); cheap for the
    // panel's usage pattern and keeps every renderer simple.
    this.mount?.(el, manifest, ctx)
  },
  dispose(el) {
    const dom = (el as HTMLElement & { __bgStudioChar?: CharacterDom }).__bgStudioChar
    if (dom) cancelAnimationFrame(dom.raf)
  },
}

function drawCharacter(el: HTMLElement, timestamp: number): void {
  const dom = (el as HTMLElement & { __bgStudioChar?: CharacterDom }).__bgStudioChar
  if (!dom) return
  const clip = dom.spec.clips[dom.clip] ?? Object.values(dom.spec.clips)[0]
  if (dom.ready && clip && dom.image.complete && dom.image.naturalWidth > 0) {
    const rect = el.getBoundingClientRect()
    if (dom.canvas.width !== Math.round(rect.width) || dom.canvas.height !== Math.round(rect.height)) {
      dom.canvas.width = Math.max(1, Math.round(rect.width))
      dom.canvas.height = Math.max(1, Math.round(rect.height))
    }
    const frameMs = 1000 / Math.max(1, dom.spec.fps)
    if (timestamp - dom.lastFrameAt >= frameMs) {
      dom.lastFrameAt = timestamp
      dom.frameIndex = (dom.frameIndex + 1) % Math.max(1, clip[1] - clip[0])
    }
    const { frameW, frameH } = dom.spec
    const cols = Math.max(1, Math.floor(dom.image.naturalWidth / frameW))
    const index = clip[0] + dom.frameIndex
    const sx = (index % cols) * frameW
    const sy = Math.floor(index / cols) * frameH
    // Draw at 2x sprite size, anchored bottom-center (mascot sits on the floor).
    const scale = 2
    const dw = frameW * scale
    const dh = frameH * scale
    dom.ctx2d.clearRect(0, 0, dom.canvas.width, dom.canvas.height)
    dom.ctx2d.drawImage(dom.image, sx, sy, frameW, frameH, (dom.canvas.width - dw) / 2, dom.canvas.height - dh, dw, dh)
  }
  dom.raf = requestAnimationFrame((t) => drawCharacter(el, t))
}
