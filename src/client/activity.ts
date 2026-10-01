/**
 * Client-side activity machine — polls the host bridge and produces two
 * streams for animated wallpapers:
 *
 *   state    idle | busy | overloaded   (task-count vs threshold)
 *   idleClip one of the idle clip names (rotates on the configured interval)
 *
 * Every change is also broadcast to web-type wallpapers via postMessage
 * ({ source:'dsh-bg-studio', type:'activity', state, activeTasks }) so iframe
 * authors can react without any DSH-specific imports.
 */
import type { ActivitySnapshot } from '../shared/protocol.ts'
import { fetchActivity } from './api.ts'

const POLL_MS = 2000

export type ActivityState = ActivitySnapshot['state']

export class ActivityMachine {
  private timer: ReturnType<typeof setInterval> | null = null
  private snapshot: ActivitySnapshot = { activeTasks: 0, state: 'idle' }
  private lastNotified = ''
  private idleClips: string[] = []
  private idleIndex = 0
  private idleRotateMs = 120_000
  private idleTimer: ReturnType<typeof setInterval> | null = null
  /** Current idle clip name (empty string when no clips configured). */
  currentIdleClip = ''
  /** Consumer callback for any change (state or idle rotation). */
  private listener: ((snapshot: ActivitySnapshot) => void) | null = null

  configure(options: { threshold: number; idleClips: string[]; idleRotateSec: number }): void {
    this.idleClips = options.idleClips
    this.idleRotateMs = Math.max(5, options.idleRotateSec) * 1000
    if (this.idleTimer) clearInterval(this.idleTimer)
    this.idleTimer = setInterval(() => this.rotateIdle(), this.idleRotateMs)
    this.idleIndex = 0
    this.currentIdleClip = this.idleClips[0] ?? ''
  }

  private rotateIdle(): void {
    if (this.idleClips.length <= 1 || this.snapshot.state !== 'idle') return
    this.idleIndex = (this.idleIndex + 1) % this.idleClips.length
    this.currentIdleClip = this.idleClips[this.idleIndex]
    this.listener?.(this.snapshot)
  }

  start(threshold: number): void {
    // Restart ONLY the poll timer: configure() owns the idle-rotation timer,
    // and clearing it here would silently kill idle clip rotation.
    if (this.timer) clearInterval(this.timer)
    const tick = (): void => {
      void fetchActivity(threshold)
        .then((snap) => {
          const before = `${this.snapshot.state}:${this.snapshot.activeTasks}`
          this.snapshot = snap
          const after = `${snap.state}:${snap.activeTasks}`
          if (before !== after) this.notify()
        })
        .catch(() => { /* host gone: keep last known state */ })
    }
    tick()
    this.timer = setInterval(tick, POLL_MS)
  }

  private notify(): void {
    const fingerprint = `${this.snapshot.state}:${this.snapshot.activeTasks}:${this.currentIdleClip}`
    if (fingerprint === this.lastNotified) return
    this.lastNotified = fingerprint
    this.listener?.(this.snapshot)
    // Broadcast for iframe wallpapers (Web Wallpaper Engine-style contract).
    try {
      window.postMessage({ source: 'dsh-bg-studio', type: 'activity', state: this.snapshot.state, activeTasks: this.snapshot.activeTasks, idleClip: this.currentIdleClip }, '*')
    } catch {
      /* postMessage never throws on sane inputs */
    }
  }

  onChange(listener: (snapshot: ActivitySnapshot) => void): void {
    this.listener = listener
  }

  get state(): ActivityState {
    return this.snapshot.state
  }

  get activeTasks(): number {
    return this.snapshot.activeTasks
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    if (this.idleTimer) clearInterval(this.idleTimer)
    this.timer = null
    this.idleTimer = null
  }
}
