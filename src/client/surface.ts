/**
 * Surface style engine — the "clear/glass" half of bg-studio.
 *
 * Design contract: TEXT COLORS ARE NEVER TOUCHED. Every --dsw-alias-label-*
 * (foreground) token stays exactly as the theme set it; we only repaint the
 * SURFACE fill tokens with translucent versions of their own colors, so the
 * light/dark decision keeps owning contrast and readability.
 *
 * Token colors below were captured from the live DSH 0.1.7 DOM in both
 * schemes (pre-decomposed to RGB triples — no runtime string parsing). DSH
 * flips them via body[data-ds-dark-theme]; our overrides are gated on
 * body[data-dsh-bg-kind="..."] which we toggle, and re-emitted with
 * scheme-aware colors whenever the user flips light/dark.
 */
import type { BgStudioSettings } from '../shared/protocol.ts'

const STYLE_ID = 'dsh-bg-studio-surface-style'

/** One surface fill token: stock color as [r, g, b] per scheme, plus the
 * stock alpha for the few tokens DSH ships semi-transparent (color-mix). */
interface SurfaceToken {
  name: string
  dark: readonly [number, number, number]
  light: readonly [number, number, number]
  /** Stock alpha for the few tokens DSH ships semi-transparent. */
  stockAlpha?: number
  /** True when two stacked containers both paint this token (compensated). */
  stacked?: boolean
}

const WHITE: readonly [number, number, number] = [255, 255, 255]

const SURFACE_TOKENS: readonly SurfaceToken[] = [
  { name: '--dsw-alias-bg-base', dark: [21, 21, 23], light: WHITE },
  { name: '--dsw-alias-bg-layer-1', dark: [35, 35, 36], light: WHITE, stacked: true },
  { name: '--dsw-alias-bg-layer-2', dark: [44, 44, 46], light: WHITE, stacked: true },
  { name: '--dsw-alias-bg-layer-3', dark: [53, 54, 56], light: WHITE, stacked: true },
  { name: '--dsw-alias-bg-module-platform', dark: [53, 54, 56], light: [245, 246, 247], stacked: true },
  { name: '--dsw-alias-bg-multi-select', dark: [33, 33, 35], light: [245, 246, 247], stacked: true },
  { name: '--dsw-alias-markdown-code-block', dark: [27, 27, 28], light: [249, 250, 251] },
  { name: '--dsw-alias-markdown-inline-code', dark: [41, 41, 41], light: [250, 250, 250] },
  { name: '--dsw-alias-settings-card-fill', dark: [44, 44, 46], light: WHITE },
  { name: '--dsw-alias-onboarding-card-fill', dark: [44, 44, 46], light: WHITE, stockAlpha: 0.8 },
  { name: '--dsw-specific-bubble', dark: [44, 44, 46], light: [237, 243, 254] },
  { name: '--dsw-specific-input-major', dark: [44, 44, 46], light: WHITE, stacked: true },
  { name: '--dsw-specific-login-input', dark: [27, 27, 28], light: [249, 250, 251] },
  { name: '--dsw-specific-sidebar-fill', dark: [27, 27, 28], light: [249, 250, 251], stacked: true },
]

/** Translucent override for one token (rgb() with the effective alpha). */
function alphaColor(token: SurfaceToken, dark: boolean, alpha: number): string {
  const rgb = dark ? token.dark : token.light
  const effective = Math.round((token.stockAlpha ?? 1) * alpha * 100) / 100
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]} / ${effective})`
}

function surfaceCss(settings: BgStudioSettings, dark: boolean): string {
  const { kind, transparent, frosted } = settings
  const lines: string[] = []

  // Base layer geometry (position only — colors come from providers).
  lines.push([
    '.dsh-bg-studio-layer {',
    '  position: fixed;',
    '  inset: 0;',
    '  z-index: 0;',
    '  pointer-events: none;',
    '  overflow: hidden;',
    '}',
    '.dsh-bg-studio-layer > * { position: absolute; inset: 0; }',
  ].join('\n'))

  if (kind === 'none') return lines.join('\n')

  // The page base goes fully see-through in every custom mode so the
  // background layer (or the window color) shows through.
  lines.push('body[data-dsh-bg-kind] { background: transparent; }')

  // Surface alpha per mode. The window base (--dsw-alias-bg-base) is always
  // fully clear: surfaces above it each carry the alpha once, so stacked
  // layers don't compound into near-opacity.
  const baseAlpha = 0
  const surfaceAlpha = kind === 'transparent' ? transparent.surfaceOpacity : kind === 'frosted' ? frosted.surfaceOpacity : 0
  // Some tokens are painted by TWO stacked containers (the sidebar column
  // wraps a second root that re-reads the same token). Alpha compounds as
  // 1-(1-a)^2 across two layers, so hand those tokens the single-layer
  // equivalent: 1-sqrt(1-alpha) — the stack then reads as the user's dial.
  const stackedAlpha = surfaceAlpha > 0 ? 1 - Math.sqrt(1 - surfaceAlpha) : 0
  lines.push(`body[data-dsh-bg-kind="${kind}"] {`)
  for (const token of SURFACE_TOKENS) {
    const alpha = token.name === '--dsw-alias-bg-base' ? baseAlpha : token.stacked ? stackedAlpha : surfaceAlpha
    lines.push(`  ${token.name}: ${alphaColor(token, dark, alpha)};`)
  }
  lines.push('}')

  return lines.join('\n')
}

/** Apply (or refresh) the injected style sheet for the given settings. */
export function applySurfaceStyle(settings: BgStudioSettings, dark: boolean): void {
  if (typeof document === 'undefined') return
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.append(style)
  }
  style.textContent = surfaceCss(settings, dark)
  const body = document.body
  if (body) {
    if (settings.kind === 'none') body.removeAttribute('data-dsh-bg-kind')
    else body.setAttribute('data-dsh-bg-kind', settings.kind)
  }
}

/** Remove every trace (used by mode "none" housekeeping and dispose). */
export function removeSurfaceStyle(): void {
  document.getElementById(STYLE_ID)?.remove()
  document.body?.removeAttribute('data-dsh-bg-kind')
}
