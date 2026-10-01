/**
 * Theme-mood prompt — the hidden courtesy: when a wallpaper clearly belongs
 * to the opposite scheme from the app's current theme (a bright movie on a
 * dark UI, a night scene under a light UI), offer a one-click theme flip in
 * a small themed toast. Manifest `tone` wins; video bundles without one are
 * auto-sampled (average frame luminance). One prompt per wallpaper per page
 * session; "don't ask again for this wallpaper" is remembered per bundle.
 */
import type { BgStudioSettings, WallpaperManifest } from '../shared/protocol.ts'
import { isDarkScheme } from './api.ts'
import { setDshThemePreference } from './theme.ts'

const TOAST_ID = 'dsh-bg-studio-mood-toast'
/** Wallpapers already prompted in this page session. */
const prompted = new Set<string>()

type Strings = {
  toLight: string
  toDark: string
  keep: string
  never: string
}

const EN: Strings = {
  toLight: 'The wallpaper woke up to daylight, but the UI is still in bed. Open the curtains together?',
  toDark: 'The wallpaper has gone stargazing, but the UI left the lights on. Turn them off together?',
  keep: 'Keep as is',
  never: 'Never ask for this wallpaper',
}

function strings(): Strings {
  const zh = navigator.language?.toLowerCase().startsWith('zh')
  const zhStrings: Strings = {
    toLight: '壁纸天亮了，界面还赖在夜里。要一起掀开窗帘吗？',
    toDark: '壁纸已入夜，界面还亮着灯。要一起关灯看星星吗？',
    keep: '保持现状',
    never: '这张壁纸不再提醒',
  }
  return zh ? zhStrings : EN
}

/** Average luminance of a video's current frame; null when not decodable. */
export function sampleVideoTone(video: HTMLVideoElement): 'dark' | 'light' | null {
  try {
    if (video.videoWidth === 0 || video.videoHeight === 0) return null
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 18
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let sum = 0
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    }
    const luma = sum / (data.length / 4) / 255
    if (luma > 0.65) return 'light'
    if (luma < 0.35) return 'dark'
    return null
  } catch {
    return null
  }
}

/** Decide + show the prompt for the active wallpaper, if warranted.
 * Returns nothing; never throws. */
export function maybePromptThemeMood(options: {
  manifest: WallpaperManifest
  settings: BgStudioSettings
  video?: HTMLVideoElement | null
  onMute: () => void
}): void {
  const { manifest, settings, video, onMute } = options
  const bundleId = settings.animated.mediaSource
  if (!bundleId || prompted.has(bundleId)) return
  const muted = settings.animated.perBundle[bundleId]?.moodMuted === true
  if (muted) return

  let tone = manifest.tone
  if (!tone && video) tone = sampleVideoTone(video)
  if (!tone) return

  const dark = isDarkScheme()
  if (tone === 'dark' && dark) return
  if (tone === 'light' && !dark) return

  prompted.add(bundleId)
  const s = strings()
  const wantLight = tone === 'light'
  const label = wantLight ? '切换到浅色模式' : '切换到深色模式'
  const text = wantLight ? s.toLight : s.toDark
  const enLabel = wantLight ? 'Switch to light mode' : 'Switch to dark mode'
  const buttonLabel = navigator.language?.toLowerCase().startsWith('zh') ? label : enLabel
  const keepLabel = s.keep
  const neverLabel = s.never
  showMoodToast(text, buttonLabel, keepLabel, neverLabel, wantLight, onMute)
}

function showMoodToast(text: string, switchLabel: string, keepLabel: string, neverLabel: string, wantLight: boolean, onMute: () => void): void {
  dismissMoodToast()
  const dark = isDarkScheme()
  const toast = document.createElement('div')
  toast.id = TOAST_ID
  toast.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:28px',
    'transform:translateX(-50%)',
    'z-index:2147483000',
    'display:flex',
    'align-items:center',
    'gap:12px',
    `background:${dark ? 'rgba(24,28,38,0.92)' : 'rgba(255,255,255,0.94)'}`,
    `color:${dark ? '#f3f5fa' : '#171a21'}`,
    'padding:12px 16px',
    'border-radius:14px',
    'box-shadow:0 8px 28px rgba(0,0,0,0.35)',
    'backdrop-filter:blur(10px)',
    'font-size:13px',
    'max-width:min(640px, 86vw)',
  ].join(';')
  const msg = document.createElement('span')
  msg.textContent = text
  msg.style.cssText = 'flex:1;line-height:1.5'
  toast.append(msg)

  const mkButton = (label: string, primary: boolean, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement('button')
    b.textContent = label
    b.style.cssText = [
      'border:none',
      'cursor:pointer',
      'border-radius:8px',
      'padding:7px 13px',
      'font-size:12.5px',
      'white-space:nowrap',
      primary
        ? `background:${wantLight ? '#2b6cb0' : '#39435c'};color:#fff`
        : `background:transparent;color:inherit;border:1px solid ${dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.22)'}`,
    ].join(';')
    b.addEventListener('click', () => {
      if (primary) void setDshThemePreference(wantLight ? 'light' : 'dark')
      else if (label === neverLabel) onMute()
      dismissMoodToast()
    })
    return b
  }
  toast.append(mkButton(neverLabel, false, onMute))
  toast.append(mkButton(keepLabel, false, () => {}))
  toast.append(mkButton(switchLabel, true, () => {}))
  document.body.append(toast)
  setTimeout(dismissMoodToast, 30000)
}

export function dismissMoodToast(): void {
  document.getElementById(TOAST_ID)?.remove()
}
