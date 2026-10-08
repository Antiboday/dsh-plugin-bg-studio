/**
 * Music-reactive wave for DSH's OFFICIAL turn navigator (0.2.0-rc+ hosts).
 *
 * The navigator is a <nav> whose marks are buttons — one per conversation
 * turn, `button[type="button"][data-index][aria-label]`, sized by the inline
 * `--turn-natural-height` variable. It may also be pre-tagged
 * `data-dcu-official-turn-navigator` by dsh-codex-ui, which detects it with
 * the same predicate (that plugin repositions it to the chat column's left
 * edge; we work with either placement).
 *
 * We only ADD a beat-synced travelling wave: each mark's `scale` (the
 * standalone CSS property, NOT `transform`) swells as the wave passes and
 * recedes after it — the lengthen-then-recede ripple, never a synchronous
 * tremble. The standalone `scale` property composes WITH whatever inline
 * `transform` the host uses to position its marks (translateY etc.), so
 * overwriting it can never collapse the navigator. Native hover, tooltips
 * and click-to-jump are untouched; the wave softens while the user hovers
 * the navigator so it never fights the official hover affordance.
 *
 * Amplitude comes from the shared page-audio engine: silence → every mark
 * rests at its natural size.
 *
 * Detection re-runs on DOM mutations (navigators mount per conversation
 * switch).
 */
import waveCss from './turnwave.css'

const TAG = 'data-bgs-turnwave'

const SWEEP_PERIOD = 2.6 // seconds per leg of the ping-pong sweep
const WAVE_SIGMA = 1.7 // marks
const MAX_SCALE = 1.9

interface NavBinding {
  nav: HTMLElement
  marks: HTMLButtonElement[]
}

/** Same contract dsh-codex-ui uses to recognise the official navigator. */
function isOfficialTurnNavigator(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement) || el.tagName !== 'NAV') return false
  if (el.querySelector('button[type="button"][aria-label]') === null) return false
  return (
    el.style.getPropertyValue('--turn-natural-height') !== '' ||
    el.querySelector('button[type="button"][data-index][aria-label]') !== null
  )
}

function marksOf(nav: HTMLElement): HTMLButtonElement[] {
  const marks = [...nav.querySelectorAll<HTMLButtonElement>('button[type="button"][data-index]')]
  marks.sort((a, b) => Number(a.getAttribute('data-index')) - Number(b.getAttribute('data-index')))
  return marks
}

export class TurnWave {
  private styleEl: HTMLStyleElement | null = null
  private bindings: NavBinding[] = []
  private bodyObserver: MutationObserver | null = null
  private scanFrame = 0
  private gate = 0 // smoothed silence gate
  private disposed = false

  start(): void {
    this.styleEl = document.createElement('style')
    this.styleEl.setAttribute('data-plugin-css', 'dsh-plugin-bg-studio-turnwave')
    this.styleEl.textContent = waveCss
    document.head.appendChild(this.styleEl)

    this.bodyObserver = new MutationObserver(() => this.scheduleScan())
    this.bodyObserver.observe(document.body, { childList: true, subtree: true })
    this.scan()
  }

  private scheduleScan(): void {
    if (this.disposed || this.scanFrame) return
    this.scanFrame = requestAnimationFrame(() => {
      this.scanFrame = 0
      this.scan()
    })
  }

  private scan(): void {
    if (this.disposed) return
    const navs = new Set<Element>()
    // dsh-codex-ui's tag first (cheap), then the raw predicate for bare hosts.
    document.querySelectorAll('[data-dcu-official-turn-navigator]').forEach((el) => navs.add(el))
    document.querySelectorAll('nav').forEach((el) => {
      if (isOfficialTurnNavigator(el)) navs.add(el)
    })

    for (const binding of this.bindings) {
      if (!navs.has(binding.nav) || !binding.nav.isConnected) {
        this.clearBinding(binding)
      }
    }
    this.bindings = this.bindings.filter((binding) => navs.has(binding.nav) && binding.nav.isConnected)

    for (const nav of navs) {
      if (!(nav instanceof HTMLElement) || nav.hasAttribute(TAG)) continue
      nav.setAttribute(TAG, '')
      // Grow into the content area regardless of left/right placement.
      const rect = nav.getBoundingClientRect()
      const growLeftward = rect.left > window.innerWidth / 2
      nav.style.setProperty('--bgs-turnwave-origin', growLeftward ? 'right center' : 'left center')
      this.bindings.push({ nav, marks: marksOf(nav) })
    }
    // Refresh mark lists on every scan: turns mount lazily.
    for (const binding of this.bindings) binding.marks = marksOf(binding.nav)
  }

  private clearBinding(binding: NavBinding): void {
    binding.nav.removeAttribute(TAG)
    binding.nav.style.removeProperty('--bgs-turnwave-origin')
    for (const mark of binding.marks) mark.style.removeProperty('scale')
  }

  /** Called once per frame by the shared loop; drives the travelling wave
   *  from the real page-audio spectrum. Silence → amplitude eases to zero. */
  frame(vals: Float32Array, tSeconds: number): void {
    if (this.disposed || this.bindings.length === 0) return
    let bass = 0
    for (let i = 0; i < 12; i++) bass += vals[i]
    bass /= 12
    let all = 0
    for (let i = 0; i < vals.length; i++) all += vals[i]
    all /= vals.length
    const energy = Math.min(1, Math.pow(0.6 * bass + 0.4 * all, 0.75) * 1.8)
    // hard silence gate with soft edges: no sound → no wave at all
    const gateTarget = energy > 0.02 ? 1 : 0
    this.gate += (gateTarget - this.gate) * 0.1
    const amplitude = energy * this.gate
    if (amplitude < 0.004) {
      for (const binding of this.bindings) {
        for (const mark of binding.marks) {
          if (mark.style.scale !== '') mark.style.scale = ''
        }
      }
      return
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const depth = reduced ? 0.35 : 1

    for (const binding of this.bindings) {
      const n = binding.marks.length
      if (n === 0) continue
      // Soften while the user is using the navigator's own hover affordance.
      const hoverSoftener = binding.nav.matches(':hover') ? 0.35 : 1
      const leg = (tSeconds % (SWEEP_PERIOD * 2)) / SWEEP_PERIOD // 0..2
      const pos = leg <= 1 ? leg * (n - 1) : (2 - leg) * (n - 1)
      for (let i = 0; i < n; i++) {
        const dm = (i - pos) / WAVE_SIGMA
        // travelling wave + this mark's own frequency band jumping with the music
        const band = vals[Math.min(vals.length - 1, Math.floor((i / n) * 40))]
        const swell = 0.65 * Math.exp(-dm * dm) + 0.55 * band
        const scale = 1 + (MAX_SCALE - 1) * swell * amplitude * depth * hoverSoftener
        // Standalone `scale` property: composes with the host's own inline
        // transform (translateY positioning) instead of replacing it.
        binding.marks[i].style.scale = `${scale.toFixed(3)} 1`
      }
    }
  }

  dispose(): void {
    this.disposed = true
    if (this.scanFrame) cancelAnimationFrame(this.scanFrame)
    this.bodyObserver?.disconnect()
    for (const binding of this.bindings.splice(0)) this.clearBinding(binding)
    this.styleEl?.remove()
    this.styleEl = null
  }
}
