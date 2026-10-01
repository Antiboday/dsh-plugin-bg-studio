# Background Studio for DeepSeek Harness

**Custom backgrounds and an animated wallpaper engine for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH)** — pictures, transparency, frosted glass, and a Wallpaper-Engine-style bundle system with video / web / canvas / task-reactive character wallpapers. One design rule above all: **your text colors are never touched** — readability always follows the app's own light/dark theme.

[中文文档](README.zh-CN.md)

> Screenshots welcome — drop them into `docs/screenshots/` and reference them here.

## Features

### Four background modes

| Mode | What you get |
|---|---|
| **Picture** | Your own image under everything: fill modes (cover / contain / tile), opacity, blur, readability scrim (strength + custom color) |
| **Transparent** | Surfaces go see-through; on Windows 11 desktop builds the window gets the system acrylic material attempted so cleared surfaces can reveal the desktop |
| **Frosted glass** | Surfaces become translucent glass over a (built-in or picture) backdrop: blur, fill, saturation — with stacked-layer alpha compensation so the sidebar reads exactly as dialed |
| **Animated** | Full wallpaper engine — see below |

Every mode is one click away in the sidebar **Background** panel. Changes apply instantly and persist automatically. "Reset current mode" restores sane defaults per mode (mode and chosen picture are kept).

### The animated wallpaper engine

Wallpapers are **bundles** (`dsh-wallpaper/1` format: a folder with a `manifest.json` + assets) with four renderer types:

- **video** — any mp4/webm the browser can decode; per-wallpaper volume / speed / fit (hot-applied, no restart). Audible autoplay rejected by the desktop policy? It degrades to muted and restores sound on your first click.
- **web** — a sandboxed iframe running any HTML page. Served HTML gets relative-URL rewriting plus a **Wallpaper Engine API shim** (`wallpaperRegister*` etc.), so most WE web wallpapers run unmodified — and every page can opt into live agent activity via `window` message events.
- **canvas** — built-in programmed scenes (ships with a drifting-nebula starfield); adding a scene is one table entry.
- **character** — a sprite-sheet mascot wired to a **task state machine**: idle (multiple clips rotating on a timer), busy, overloaded (threshold-configurable) — your companion naps, types and panics with your agents. The state bridge reads only turn metadata, never transcript content.

### Wallpaper Engine import

Point the panel at your Steam workshop content folder (`…\steamapps\workshop\content\431960`) and it lists everything: video and web wallpapers convert into bundles **in one click** (nothing is written into the workshop folder; video bundles copy just the movie file). Scene-type wallpapers are flagged as unsupported with the reason. A CLI converter (`dev-assets/we2dsh.py`) is included for headless use.

### Theme-mood courtesy prompts

Activate a wallpaper that clearly belongs to the opposite scheme — a bright movie on a dark UI, a night scene under a light UI — and a small toast offers a one-click theme flip through the app's official settings channel:

> *"The wallpaper has gone stargazing, but the UI left the lights on. Turn them off together?"* 🌙
> *"The wallpaper woke up to daylight, but the UI is still in bed. Open the curtains together?"* ☀️

Tone comes from the manifest, or is auto-detected by sampling video luminance. Every activation of a mismatching wallpaper re-asks; the only mute is your explicit per-wallpaper "never ask".

### Fit and finish

- **Full i18n** through the DSH locale service — the whole panel (and the prompts) follow the app's language setting live, English and Chinese out of the box.
- The plugin panel and DSH's own system dialogs each have an **independent opacity switch** (both default to opaque in transparent/glass modes, so settings stay readable).
- The settings panel scrolls itself inside the app's clipping layout, and native select popups honor dark mode.
- **Privacy by design**: all routes are loopback-fenced; the activity bridge reads turn event metadata only — never session content.

## Install

**From a release tarball** (recommended): download the `.tgz` from [releases](../../releases), then in DSH open *Plugins → install from local package* and give the tarball's absolute path. **Fully quit DSH (tray included) and reopen** — plugin code is cached aggressively.

**From GitHub** (tagged source carries prebuilt `lib/`, no build needed):

```text
github:<user>/dsh-plugin-bg-studio#v0.4.2
```

**From npm** (if published):

```text
dsh-plugin-bg-studio
```

> ⚠️ If the DSH plugin manager rejects install/uninstall with
> `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` naming some unrelated package, a
> same-day-published dependency is blocking the whole lockfile (a 24h
> supply-chain cooldown). Fully quit DSH and retry after the window, or see
> [Troubleshooting](#troubleshooting).

## Writing a wallpaper bundle

A bundle is a directory:

```
my-wallpaper/
├── manifest.json
└── …assets (movie / html / sprite sheet / scene id)
```

```jsonc
// manifest.json
{
  "format": "dsh-wallpaper/1",
  "name": "My Wallpaper",
  "description": "…",
  "author": "you",
  "type": "video",            // video | web | canvas | character
  "entry": "bg.mp4",          // video: file · web: html file · canvas: "scene:nebula" · character: mascot.json
  "tone": "dark",             // optional: dark | light — enables the theme-mood prompt
  "states": {                 // character only: clip names referenced by mascot.json
    "idle": ["nap", "wag"],
    "busy": ["type"],
    "overloaded": ["panic"]
  }
}
```

Character bundles add a `mascot.json` (sprite-sheet spec: frame size, fps, named clip ranges) — see `dev-assets/wallpapers/wp-character-demo/` for a complete working example of every type.

**Web wallpapers** receive live agent activity as window messages:

```js
window.addEventListener('message', (ev) => {
  const d = ev.data
  if (d?.source === 'dsh-bg-studio' && d?.type === 'activity') {
    // d.state: 'idle' | 'busy' | 'overloaded'   d.idleClip: current idle clip name
  }
})
```

Import bundles from the panel (any local folder containing `manifest.json`).

## Troubleshooting

- **Install/uninstall blocked by `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`** — a dependency published within the last 24h makes the desktop plugin manager validate the entire lockfile and fail. It self-heals after the window. Immediate workaround: fully quit DSH, then `pnpm add/remove` inside `%DSH_HOME%\profiles\<name>` with the system pnpm (it carries no such policy) and keep `dsh.profile.bundles` in sync.
- **Updated but behavior unchanged** — fully quit DSH (tray included) and reopen; cached plugin code otherwise keeps running.
- **A web wallpaper shows blank** — its scripts may use browser APIs the sandbox withholds; the shipped shim covers the Wallpaper Engine API family, anything else is a bug worth filing.

## Development

```sh
pnpm install
node tools/build.mjs      # esbuild → lib/index.js (host ESM) + lib/client.js (ModuleLoader-wrapped)

# disposable test profile (never touches your desktop profile)
dsh devbg --from-default-profile web        # boots once, Ctrl+C
dsh plugin --profile devbg add "$(pwd)"
dsh --profile devbg                          # Web UI at 127.0.0.1:3080
```

Architecture in brief: a `shared/` protocol (settings + bundle format), a Node host (settings store, media/bundle library with loopback-fenced routes, session/event activity bridge), and a web client (provider registry → four renderers, surface-token styling, i18n, mood prompts). Adding a renderer, a canvas scene or a bundle field never touches the host.

Test bundles live in `dev-assets/wallpapers/`; `dev-assets/we2dsh.py` is the headless workshop converter.

## Roadmap

- More built-in canvas scenes; Lottie / Spine runtimes for character bundles
- Audio-reactive hooks for web wallpapers (page-side opt-in)
- Zip bundle import
- True window transparency on the Windows desktop build (blocked upstream — see deepseek-harness discussions)

## License

[MIT](LICENSE)
