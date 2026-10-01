/**
 * Host-side agent-activity bridge — the signal source for character and
 * interactive wallpapers.
 *
 * Mirrors the whale-pet precedent: subscribe to the global session/event
 * stream (turn/start, turn/end with per-session seq fencing) and distill it
 * into one number — sessions with a started-but-unfinished turn — plus the
 * derived machine state against a caller-supplied threshold. Contents are
 * never read; only event metadata.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ActivitySnapshot } from '../shared/protocol.ts'

/** Test hook: when set, the snapshot reports this state regardless of live
 * data, so state-machine wallpapers can be verified without running real
 * agent tasks. Cleared by passing null. */
let debugStateOverride: ActivitySnapshot['state'] | null = null

export function setDebugState(state: ActivitySnapshot['state'] | null): void {
  debugStateOverride = state
}

export class ActivityBridge {
  /** sessionId → last seen seq (fences duplicates and out-of-order events). */
  private seen = new Map<string, number>()
  /** sessions currently inside a turn. */
  private active = new Set<string>()

  constructor() {}

  /** Feed one session event; ignores everything except turn boundaries. */
  accept(sessionId: unknown, event: { type?: string; seq?: number }): void {
    if (typeof sessionId !== 'string' || sessionId === '') return
    const seq = Number(event?.seq)
    if (!Number.isSafeInteger(seq) || seq < 0) return
    if (seq <= (this.seen.get(sessionId) ?? -1)) return
    if (event.type === 'turn/start') {
      this.seen.set(sessionId, seq)
      this.active.add(sessionId)
    } else if (event.type === 'turn/end') {
      this.seen.set(sessionId, seq)
      this.active.delete(sessionId)
    }
    // Bound the fencing map (sessions are unbounded over app lifetime).
    if (this.seen.size > 4096) {
      const oldest = this.seen.keys()
      for (let i = 0; i < 1024; i++) {
        const key = oldest.next()
        if (key.done) break
        this.seen.delete(key.value)
      }
    }
  }

  /** Current snapshot against a task-count threshold. */
  snapshot(threshold: number): ActivitySnapshot {
    if (debugStateOverride !== null) {
      const count = debugStateOverride === 'idle' ? 0 : debugStateOverride === 'busy' ? 1 : threshold + 1
      return { activeTasks: count, state: debugStateOverride }
    }
    const activeTasks = this.active.size
    const state = activeTasks === 0 ? 'idle' : activeTasks <= threshold ? 'busy' : 'overloaded'
    return { activeTasks, state }
  }

  dispose(): void {
    this.seen.clear()
    this.active.clear()
  }
}

/** Wire the bridge onto the host context. Returns the bridge. */
export function mountActivityBridge(ctx: Context): ActivityBridge {
  const bridge = new ActivityBridge()
  ctx.on('session/event', (session: { id?: unknown }, event: { type?: string; seq?: number }) => {
    bridge.accept(session?.id, event)
  }, { global: true } as never)
  ctx.effect(() => () => bridge.dispose(), 'bg-studio: activity bridge')
  return bridge
}
