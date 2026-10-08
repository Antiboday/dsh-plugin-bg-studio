/**
 * Page-audio engine: listens to the audio DSH itself plays.
 *
 * Every <audio>/<video> element in the page (sound effects, whale pet,
 * notifications — whatever DSH renders) is routed through one shared
 * AudioContext: MediaElementSource → Analyser → destination. The destination
 * connection keeps the sound audible — routing an element into a context
 * without connecting it back would mute it. Elements are hooked only while
 * the context is running (a suspended context would silence them); the
 * context is created/resumed on the first user gesture when the host applies
 * the autoplay policy.
 *
 * The spectrum follows the Wallpaper-Engine visualizer recipe: log-binned
 * bands, slow-decay peak normalization (auto gain), and asymmetric
 * attack/release smoothing so lines jump on hits and settle afterwards.
 * No sound → all values decay to zero.
 */
export const BAR_COUNT = 64

export class AudioEngine {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private freq: Uint8Array | null = null
  private binLo: Uint16Array | null = null
  private binHi: Uint16Array | null = null
  private hooked = new WeakSet<HTMLMediaElement>()
  private hookedCount = 0
  private observer: MutationObserver | null = null
  private retryTimer = 0
  private peak = 0.2
  private gate = 0 // smoothed silence gate 0..1
  private vals = new Float32Array(BAR_COUNT)
  private gestureBound = false
  private lastFrameMax = 0

  /** Diagnostic probe (namespaced global) — lets support check where the
   *  chain stands: context state, hooked element count, live frame energy. */
  private installProbe(): void {
    (window as unknown as Record<string, unknown>).__bgStudioAudio = (): Record<string, unknown> => ({
      ctxState: this.ctx?.state ?? 'none',
      analyser: !!this.analyser,
      hooked: this.hookedCount,
      frameMax: Math.round(this.lastFrameMax * 1000) / 1000,
      gate: Math.round(this.gate * 1000) / 1000,
    })
  }

  /** Must be called after DOM exists; idempotent. */
  start(): void {
    this.tryCreateContext()
    if (this.ctx && this.ctx.state !== 'running') this.bindGesture()
    this.hookAll()
    this.installProbe()
    this.observer = new MutationObserver(() => this.hookAll())
    this.observer.observe(document.body, { childList: true, subtree: true })
    // Belt and braces: hosts without the autoplay policy resume instantly;
    // policy-bound hosts may allow resume later without a visible gesture.
    this.retryTimer = window.setInterval(() => {
      if (this.ctx?.state === 'running') {
        window.clearInterval(this.retryTimer)
        this.retryTimer = 0
        return
      }
      this.tryCreateContext()
    }, 4000)
  }

  private tryCreateContext(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined)
      return
    }
    try {
      this.ctx = new AudioContext()
      if (this.ctx.state === 'running') this.buildGraph()
      else this.ctx.addEventListener('statechange', () => {
        if (this.ctx?.state === 'running') {
          this.buildGraph()
          this.hookAll()
        }
      })
    } catch {
      this.ctx = null
    }
  }

  private bindGesture(): void {
    if (this.gestureBound) return
    this.gestureBound = true
    const resume = () => {
      this.tryCreateContext()
      if (this.ctx?.state === 'running') {
        for (const type of ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'click'] as const) {
          window.removeEventListener(type, resume)
        }
      }
    }
    for (const type of ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'click'] as const) {
      window.addEventListener(type, resume, { passive: true })
    }
  }

  private buildGraph(): void {
    if (!this.ctx || this.analyser) return
    const analyser = this.ctx.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.6
    analyser.connect(this.ctx.destination)
    this.analyser = analyser
    this.freq = new Uint8Array(analyser.frequencyBinCount)
    this.buildBins(analyser.frequencyBinCount)
  }

  /** Route every media element through the analyser (and back out, audible). */
  private hookAll(): void {
    if (!this.ctx || this.ctx.state !== 'running' || !this.analyser) return
    document.querySelectorAll('audio, video').forEach((el) => {
      if (!(el instanceof HTMLMediaElement) || this.hooked.has(el)) return
      try {
        const source = this.ctx!.createMediaElementSource(el)
        source.connect(this.analyser!)
        this.hooked.add(el)
        this.hookedCount++
      } catch {
        // element already attached to another context — leave it alone
        this.hooked.add(el)
      }
    })
  }

  /** Log-spaced bar → frequency-bin ranges over the useful low 70% of bins. */
  private buildBins(binCount: number): void {
    const usable = Math.max(8, Math.floor(binCount * 0.7))
    const lo = new Uint16Array(BAR_COUNT)
    const hi = new Uint16Array(BAR_COUNT)
    for (let i = 0; i < BAR_COUNT; i++) {
      const a = Math.floor(Math.pow(usable, i / BAR_COUNT))
      const b = Math.floor(Math.pow(usable, (i + 1) / BAR_COUNT))
      lo[i] = Math.min(a, usable - 1)
      hi[i] = Math.max(b, a + 1)
    }
    this.binLo = lo
    this.binHi = hi
  }

  /** Advance one frame (dt seconds); returns the 0..1 bar values in place. */
  tick(dt: number): Float32Array {
    if (!this.analyser || !this.freq || !this.binLo || !this.binHi) {
      this.decay(0.06)
      return this.vals
    }
    this.analyser.getByteFrequencyData(this.freq as Uint8Array<ArrayBuffer>)
    let frameMax = 0
    for (let i = 0; i < BAR_COUNT; i++) {
      let sum = 0
      const lo = this.binLo[i]
      const hi = Math.min(this.binHi[i], this.freq.length)
      for (let b = lo; b < hi; b++) sum += this.freq[b]
      let v = sum / Math.max(1, hi - lo) / 255
      v *= 0.75 + 0.6 * (i / BAR_COUNT)
      frameMax = Math.max(frameMax, v)
      v = v > 0.004 ? v : 0
      // attack fast, release slow — jump on the hit, settle after it
      const k = v > this.vals[i] ? 0.5 : 0.16
      this.vals[i] += (v - this.vals[i]) * k
    }
    this.lastFrameMax = frameMax
    // slow-decay peak normalization (Wallpaper Engine visualizer recipe)
    this.peak = Math.max(this.peak * 0.995 + frameMax * 0.005, 0.12)
    const gain = 0.9 / this.peak
    for (let i = 0; i < BAR_COUNT; i++) {
      this.vals[i] = Math.min(1, this.vals[i] * gain)
    }
    // silence gate: below threshold everything eases to zero
    const target = frameMax > 0.02 ? 1 : 0
    this.gate += (target - this.gate) * 0.12
    if (this.gate < 0.999) {
      for (let i = 0; i < BAR_COUNT; i++) this.vals[i] *= this.gate
    }
    return this.vals
  }

  private decay(rate: number): void {
    for (let i = 0; i < BAR_COUNT; i++) this.vals[i] *= 1 - rate
  }

  dispose(): void {
    this.observer?.disconnect()
    if (this.retryTimer) window.clearInterval(this.retryTimer)
    // The context and its graph are deliberately LEFT RUNNING: hooked media
    // elements are routed through it (closing or disconnecting would mute
    // DSH's own sounds). We only drop our own references.
    this.ctx = null
    this.analyser = null
    this.freq = null
    this.binLo = null
    this.binHi = null
  }
}
