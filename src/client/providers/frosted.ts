/**
 * Frosted-glass provider — supplies the visual backdrop that the glass
 * surfaces blur: the user's picture when one is picked, otherwise a built-in
 * soft gradient (backdrop-filter needs something behind the surface to
 * sample; a flat window color would look like plain translucency).
 *
 * Saturation from the frosted settings is applied here so the sampled
 * backdrop is richer before the surfaces' blur reads it.
 */
import type { BgStudioSettings } from '../../shared/protocol.ts'
import type { BackgroundProvider, ProviderContext } from '../background.ts'

function render(el: HTMLElement, settings: BgStudioSettings, ctx: ProviderContext): void {
  const { frosted } = settings

  let div = el.querySelector<HTMLDivElement>('.dsh-bg-studio-frostbg')
  if (!div) {
    div = document.createElement('div')
    div.className = 'dsh-bg-studio-frostbg'
    el.append(div)
  }
  if (frosted.imageId) {
    div.style.backgroundImage = `url("${ctx.imageUrl(frosted.imageId)}")`
    div.style.backgroundSize = 'cover'
    div.style.backgroundPosition = 'center'
  } else {
    // Built-in backdrop: bright enough and colorful enough to read through
    // translucent surfaces (a near-black gradient would look like plain
    // translucency), yet calm enough to keep text contrast comfortable.
    const a = ctx.isDark() ? '#2c3a5e' : '#dbe7fb'
    const b = ctx.isDark() ? '#4a2f5e' : '#f3ecfb'
    const c = ctx.isDark() ? '#1d2742' : '#cfe3f7'
    div.style.backgroundImage = `radial-gradient(120% 90% at 18% 12%, ${a} 0%, ${c} 55%, ${b} 100%)`
  }
  div.style.filter = `saturate(${frosted.saturation})`
  // The glass blur lives here on the backdrop itself (not on surfaces via
  // backdrop-filter): translucency comes from the surface tokens, and this
  // pre-blurred backdrop reads through them as frosted glass. Scale pads the
  // blur's transparent edges so they never ring the window.
  if (frosted.blur > 0) {
    div.style.filter = `blur(${frosted.blur}px) saturate(${frosted.saturation})`
    div.style.transform = 'scale(1.15)'
  }
}

export const frostedProvider: BackgroundProvider = {
  mount(el, settings, ctx) {
    el.replaceChildren()
    render(el, settings, ctx)
  },
  update(el, settings, ctx) {
    render(el, settings, ctx)
  },
}
