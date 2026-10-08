/**
 * Turn-navigator music wave — self-contained runner merged from the retired
 * dsh-plugin-pulse-divider plugin. Owns the page-audio engine and the wave
 * on the official turn navigator's marks; returns a single disposer.
 */
import { AudioEngine } from './audio.ts'
import { TurnWave } from './turnwave.ts'

export function startTurnWave(): () => void {
  const disposers: Array<() => void> = []

  const engine = new AudioEngine()
  try {
    engine.start()
    disposers.push(() => engine.dispose())
  } catch (error) {
    console.warn('[bg-studio:turnwave] audio engine start failed:', error)
  }

  const wave = new TurnWave()
  try {
    wave.start()
    disposers.push(() => wave.dispose())
  } catch (error) {
    console.warn('[bg-studio:turnwave] start failed:', error)
    for (const dispose of disposers.splice(0)) dispose()
    return () => undefined
  }

  let raf = 0
  const t0 = performance.now()
  let lastT = t0
  const step = (now: number): void => {
    const dt = Math.min(0.1, (now - lastT) / 1000)
    lastT = now
    wave.frame(engine.tick(dt), (now - t0) / 1000)
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
  disposers.push(() => cancelAnimationFrame(raf))

  return () => {
    for (const dispose of disposers.splice(0)) dispose()
  }
}
