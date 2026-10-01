/**
 * Client runtime — one instance per browser page, owning the full pipeline:
 *
 *   settings (host, persisted) ─→ surface style (surface.ts)
 *                              └→ background layer (background.ts + provider)
 *
 * The settings panel drives the runtime directly; every change applies
 * locally at once (instant preview) and persists to the host debounced, so
 * slider drags cost one PUT, not one per pixel.
 */
import type { BgStudioSettings, ImageEntry, SettingsPayload } from '../shared/protocol.ts'
import { DEFAULT_SETTINGS } from '../shared/protocol.ts'
import { BackgroundLayer, type ProviderContext } from './background.ts'
import { applySurfaceStyle, removeSurfaceStyle } from './surface.ts'
import { deleteImage, fetchSettings, imageUrl, isDarkScheme, resetSettings, saveSettings, setWindowMaterial, subscribeColorScheme, uploadImage } from './api.ts'

const PERSIST_DEBOUNCE_MS = 350

export class BgStudioRuntime {
  private settings: BgStudioSettings | null = null
  private images: ImageEntry[] = []
  private layer = new BackgroundLayer()
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private offScheme: (() => void) | null = null
  /** DWM material verdict: 'unknown' until first try, then 'ok'/'unavailable'. */
  materialSupport: 'unknown' | 'ok' | 'unavailable' = 'unknown'
  private materialNow: 'acrylic' | 'none' | null = null
  private providerCtx: ProviderContext = {
    imageUrl,
    isDark: isDarkScheme,
    onSchemeChange: subscribeColorScheme,
  }
  /** Panels re-render on state changes (settings swaps, library edits). */
  private listeners = new Set<() => void>()

  get current(): BgStudioSettings | null {
    return this.settings
  }

  get library(): ImageEntry[] {
    return this.images
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener()
      } catch {
        /* a broken panel must not break the runtime */
      }
    }
  }

  private paint(): void {
    if (!this.settings) return
    applySurfaceStyle(this.settings, isDarkScheme())
    this.layer.setSettings(this.settings, this.providerCtx)
    if (document.body) {
      // Panel/system-dialog opacity preference, read by the surface CSS.
      document.body.setAttribute('data-dsh-bg-panel', this.settings.panelOpaque === false ? 'clear' : 'opaque')
    }
    void this.syncWindowMaterial(this.settings.kind)
  }

  /** Best-effort: transparent mode asks the desktop window for the Win11
   * acrylic material (so cleared surfaces reveal the desktop); any other
   * mode restores the stock opaque backing. Unsupported hosts answer once
   * and we stop asking. */
  private async syncWindowMaterial(kind: string): Promise<void> {
    const want: 'acrylic' | 'none' = kind === 'transparent' ? 'acrylic' : 'none'
    if (this.materialNow === want) return
    try {
      const result = await setWindowMaterial(want)
      if (result.ok) {
        this.materialNow = want
        if (this.materialSupport !== 'ok') {
          this.materialSupport = 'ok'
          this.emit()
        }
      } else if (want === 'acrylic') {
        if (this.materialSupport !== 'unavailable') {
          this.materialSupport = 'unavailable'
          this.emit()
        }
        this.materialNow = this.materialNow ?? 'none'
      }
    } catch {
      /* host unreachable: local preview keeps working */
    }
  }

  /** Boot: load settings and paint. Scheme flips repaint (dark gradient
   * variants). Safe to call before body exists (waits for DOMContentLoaded). */
  async start(): Promise<void> {
    try {
      const payload: SettingsPayload = await fetchSettings()
      this.settings = payload.settings
      this.images = payload.images
    } catch {
      // Host unreachable (old DSH, plugin disabled): stay stock, panel shows
      // an offline note instead of pretending.
      return
    }
    const begin = () => {
      this.paint()
      this.offScheme = subscribeColorScheme(() => this.paint())
    }
    if (document.body) begin()
    else document.addEventListener('DOMContentLoaded', begin, { once: true })
    this.emit()
  }

  /** Apply a patch locally now, persist debounced. */
  update(patch: Partial<Record<keyof BgStudioSettings, unknown>>): void {
    if (!this.settings) return
    this.settings = { ...this.settings, ...patch } as BgStudioSettings
    this.paint()
    this.emit()
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      void saveSettings(this.settings as BgStudioSettings).catch(() => {
        /* host gone: local preview keeps working this page load */
      })
    }, PERSIST_DEBOUNCE_MS)
  }

  async reset(): Promise<void> {
    try {
      const payload = await resetSettings()
      this.settings = payload.settings
      this.images = payload.images
    } catch {
      return
    }
    this.paint()
    this.emit()
  }

  /** Reset ONLY the current mode's parameters to that mode's defaults —
   * the mode itself and the chosen library image stay, so a slider run
   * too far is always one click from sane values. */
  resetMode(): void {
    if (!this.settings) return
    const kind = this.settings.kind
    if (kind === 'none') return
    const patch: Partial<BgStudioSettings> = { [kind]: { ...DEFAULT_SETTINGS[kind] } }
    // Keep the selected picture: it is a choice, not a "run too far" value.
    if (kind === 'image' && this.settings.image.imageId) {
      patch.image = { ...DEFAULT_SETTINGS.image, imageId: this.settings.image.imageId }
    }
    if (kind === 'frosted' && this.settings.frosted.imageId) {
      patch.frosted = { ...DEFAULT_SETTINGS.frosted, imageId: this.settings.frosted.imageId }
    }
    this.update(patch)
  }

  async addImage(file: File): Promise<void> {
    const { id } = await uploadImage(file)
    this.images = [{ id, name: file.name, bytes: file.size, mime: file.type, addedAt: Date.now() }, ...this.images]
    // Auto-select the freshly added picture in whichever mode wants one.
    if (this.settings?.kind === 'image' && !this.settings.image.imageId) {
      this.update({ image: { ...this.settings.image, imageId: id } })
    } else {
      this.emit()
    }
  }

  async removeImage(id: string): Promise<void> {
    await deleteImage(id)
    this.images = this.images.filter((entry) => entry.id !== id)
    if (this.settings) {
      const image = this.settings.image.imageId === id ? { ...this.settings.image, imageId: null } : this.settings.image
      const frosted = this.settings.frosted.imageId === id ? { ...this.settings.frosted, imageId: null } : this.settings.frosted
      this.update({ image, frosted })
    } else {
      this.emit()
    }
  }

  dispose(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.offScheme?.()
    this.layer.dispose()
    removeSurfaceStyle()
    if (this.materialNow === 'acrylic') void setWindowMaterial('none').catch(() => {})
    this.listeners.clear()
  }
}
