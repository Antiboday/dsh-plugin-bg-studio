/**
 * Built-in canvas scenes for "canvas"-type wallpaper bundles
 * (manifest entry: "scene:<name>"). Each scene owns a <canvas> it creates
 * inside the layer element; add a scene by adding one table entry — that is
 * the whole extension surface.
 */
export interface CanvasScene {
  /** One animation frame at time t (seconds). */
  frame(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void
}

/** Slow drifting starfield with a soft nebula glow — the "hello world". */
export const nebulaScene: CanvasScene = {
  frame(ctx, w, h, t) {
    const stars: Array<{ x: number; y: number; r: number; p: number; s: number }> = []
    // Deterministic hash-rand on purpose: the starfield must be identical
    // every frame (visual stability), and no cryptography is involved.
    const rand = (i: number): number => {
      const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
      return x - Math.floor(x)
    }
    for (let i = 0; i < 160; i++) {
      stars.push({ x: rand(i) * w, y: rand(i + 500) * h, r: 0.4 + rand(i + 900) * 1.6, p: rand(i + 1300) * Math.PI * 2, s: 2 + rand(i + 1700) * 8 })
    }
    const grad = ctx.createRadialGradient(w * (0.3 + 0.1 * Math.sin(t * 0.05)), h * 0.35, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75)
    grad.addColorStop(0, 'rgba(70, 90, 160, 0.28)')
    grad.addColorStop(0.55, 'rgba(40, 30, 70, 0.20)')
    grad.addColorStop(1, 'rgba(10, 10, 20, 0)')
    ctx.fillStyle = '#0b0d18'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    for (const star of stars) {
      const x = (star.x + t * star.s) % (w + 20) - 10
      const twinkle = 0.5 + 0.5 * Math.sin(t * 1.4 + star.p)
      ctx.globalAlpha = 0.25 + 0.75 * twinkle
      ctx.fillStyle = '#dfe8ff'
      ctx.beginPath()
      ctx.arc(x, star.y, star.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  },
}

export const CANVAS_SCENES: Record<string, CanvasScene> = {
  nebula: nebulaScene,
}
