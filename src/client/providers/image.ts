/**
 * Image background provider — the user's chosen picture under everything.
 *
 * Layer content (all absolute, stacked in order):
 *   .dsh-bg-studio-img    the picture (fit / opacity / blur)
 *   .dsh-bg-studio-dim    readability scrim (dim / tint)
 */
import type { BgStudioSettings } from '../../shared/protocol.ts'
import type { BackgroundProvider, ProviderContext } from '../background.ts'

function render(el: HTMLElement, settings: BgStudioSettings, ctx: ProviderContext): void {
  const { image } = settings

  let img = el.querySelector<HTMLDivElement>('.dsh-bg-studio-img')
  if (!img) {
    img = document.createElement('div')
    img.className = 'dsh-bg-studio-img'
    el.append(img)
  }
  if (image.imageId) {
    const url = ctx.imageUrl(image.imageId)
    img.style.backgroundImage = `url("${url}")`
    img.style.backgroundSize = image.fit === 'tile' ? 'auto' : image.fit
    img.style.backgroundRepeat = image.fit === 'tile' ? 'repeat' : 'no-repeat'
    img.style.backgroundPosition = 'center'
  } else {
    // No picture yet: a calm neutral gradient so "image mode" still reads.
    const from = ctx.isDark() ? '#1a2030' : '#dfe7f2'
    const to = ctx.isDark() ? '#10141d' : '#cfd9ea'
    img.style.backgroundImage = `linear-gradient(135deg, ${from}, ${to})`
    img.style.backgroundSize = 'cover'
  }
  img.style.opacity = String(image.opacity)
  img.style.filter = image.blur > 0 ? `blur(${image.blur}px)` : 'none'

  let dim = el.querySelector<HTMLDivElement>('.dsh-bg-studio-dim')
  if (!dim) {
    dim = document.createElement('div')
    dim.className = 'dsh-bg-studio-dim'
    el.append(dim)
  }
  dim.style.background = image.tint ?? `rgba(0,0,0,${image.dim})`
}

export const imageProvider: BackgroundProvider = {
  mount(el, settings, ctx) {
    el.replaceChildren()
    render(el, settings, ctx)
  },
  update(el, settings, ctx) {
    render(el, settings, ctx)
  },
}
