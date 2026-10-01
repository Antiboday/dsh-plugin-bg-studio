/**
 * Transparent mode provider — no picture at all: surfaces go see-through
 * (surface.ts does that part) and this layer only paints the optional
 * readability scrim, so long conversations stay legible over whatever sits
 * behind the app window.
 */
import type { BgStudioSettings } from '../../shared/protocol.ts'
import type { BackgroundProvider } from '../background.ts'

function render(el: HTMLElement, settings: BgStudioSettings): void {
  const scrim = settings.transparent.scrim
  let div = el.querySelector<HTMLDivElement>('.dsh-bg-studio-scrim')
  if (!div) {
    div = document.createElement('div')
    div.className = 'dsh-bg-studio-scrim'
    el.append(div)
  }
  div.style.background = `rgba(0,0,0,${scrim})`
}

export const transparentProvider: BackgroundProvider = {
  mount(el, settings) {
    el.replaceChildren()
    render(el, settings)
  },
  update(el, settings) {
    render(el, settings)
  },
}
