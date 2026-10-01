window.__ModuleLoader__.load({id:'dsh-plugin-bg-studio',factory:function(require){var module={exports:{}};var exports=module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/shared/protocol.ts
var DEFAULT_BUNDLE_SETTINGS = {
  volume: 0,
  rate: 1,
  fit: "cover",
  taskThreshold: 3,
  idleRotateSec: 120,
  moodMuted: false
};
var DEFAULT_SETTINGS = {
  kind: "none",
  image: { imageId: null, fit: "cover", opacity: 1, blur: 0, dim: 0.25, tint: null },
  transparent: { surfaceOpacity: 0, scrim: 0.08 },
  frosted: { blur: 18, surfaceOpacity: 0.55, saturation: 1.25, imageId: null },
  animated: { mediaSource: null, respectReducedMotion: true, perBundle: {} },
  panelOpaque: true,
  systemDialogsOpaque: true
};
function clamp(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
function sanitizeBundleSettings(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    volume: clamp(Number(src.volume ?? 0), 0, 1),
    rate: clamp(Number(src.rate ?? 1), 0.25, 4),
    fit: ["cover", "contain", "fill"].includes(src.fit) ? src.fit : "cover",
    taskThreshold: clamp(Number(src.taskThreshold ?? 3), 1, 16),
    idleRotateSec: clamp(Number(src.idleRotateSec ?? 120), 5, 3600),
    moodMuted: src.moodMuted === true
  };
}

// src/client/providers/image.ts
function render(el, settings, ctx) {
  const { image } = settings;
  let img = el.querySelector(".dsh-bg-studio-img");
  if (!img) {
    img = document.createElement("div");
    img.className = "dsh-bg-studio-img";
    el.append(img);
  }
  if (image.imageId) {
    const url = ctx.imageUrl(image.imageId);
    img.style.backgroundImage = `url("${url}")`;
    img.style.backgroundSize = image.fit === "tile" ? "auto" : image.fit;
    img.style.backgroundRepeat = image.fit === "tile" ? "repeat" : "no-repeat";
    img.style.backgroundPosition = "center";
  } else {
    const from = ctx.isDark() ? "#1a2030" : "#dfe7f2";
    const to = ctx.isDark() ? "#10141d" : "#cfd9ea";
    img.style.backgroundImage = `linear-gradient(135deg, ${from}, ${to})`;
    img.style.backgroundSize = "cover";
  }
  img.style.opacity = String(image.opacity);
  img.style.filter = image.blur > 0 ? `blur(${image.blur}px)` : "none";
  let dim = el.querySelector(".dsh-bg-studio-dim");
  if (!dim) {
    dim = document.createElement("div");
    dim.className = "dsh-bg-studio-dim";
    el.append(dim);
  }
  dim.style.background = image.tint ?? `rgba(0,0,0,${image.dim})`;
}
var imageProvider = {
  mount(el, settings, ctx) {
    el.replaceChildren();
    render(el, settings, ctx);
  },
  update(el, settings, ctx) {
    render(el, settings, ctx);
  }
};

// src/client/providers/transparent.ts
function render2(el, settings) {
  const scrim = settings.transparent.scrim;
  let div = el.querySelector(".dsh-bg-studio-scrim");
  if (!div) {
    div = document.createElement("div");
    div.className = "dsh-bg-studio-scrim";
    el.append(div);
  }
  div.style.background = `rgba(0,0,0,${scrim})`;
}
var transparentProvider = {
  mount(el, settings) {
    el.replaceChildren();
    render2(el, settings);
  },
  update(el, settings) {
    render2(el, settings);
  }
};

// src/client/providers/frosted.ts
function render3(el, settings, ctx) {
  const { frosted } = settings;
  let div = el.querySelector(".dsh-bg-studio-frostbg");
  if (!div) {
    div = document.createElement("div");
    div.className = "dsh-bg-studio-frostbg";
    el.append(div);
  }
  if (frosted.imageId) {
    div.style.backgroundImage = `url("${ctx.imageUrl(frosted.imageId)}")`;
    div.style.backgroundSize = "cover";
    div.style.backgroundPosition = "center";
  } else {
    const a = ctx.isDark() ? "#2c3a5e" : "#dbe7fb";
    const b = ctx.isDark() ? "#4a2f5e" : "#f3ecfb";
    const c = ctx.isDark() ? "#1d2742" : "#cfe3f7";
    div.style.backgroundImage = `radial-gradient(120% 90% at 18% 12%, ${a} 0%, ${c} 55%, ${b} 100%)`;
  }
  div.style.filter = `saturate(${frosted.saturation})`;
  if (frosted.blur > 0) {
    div.style.filter = `blur(${frosted.blur}px) saturate(${frosted.saturation})`;
    div.style.transform = "scale(1.15)";
  }
}
var frostedProvider = {
  mount(el, settings, ctx) {
    el.replaceChildren();
    render3(el, settings, ctx);
  },
  update(el, settings, ctx) {
    render3(el, settings, ctx);
  }
};

// src/client/api.ts
var BASE = "api/dsh-bg-studio";
async function json(input, init) {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(`bg-studio api ${res.status}`);
  return res.json();
}
function imageUrl(id) {
  return `${BASE}/image?id=${encodeURIComponent(id)}`;
}
async function fetchSettings() {
  return json(`${BASE}/settings`, { cache: "no-store" });
}
async function saveSettings(patch) {
  return json(`${BASE}/settings`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch)
  });
}
async function resetSettings() {
  return json(`${BASE}/reset`, { method: "POST" });
}
async function uploadImage(file) {
  const res = await fetch(`${BASE}/images?name=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: { "content-type": file.type || "image/png" },
    body: file
  });
  if (!res.ok) throw new Error(`bg-studio upload ${res.status}`);
  return res.json();
}
async function deleteImage(id) {
  const res = await fetch(`${BASE}/images?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`bg-studio delete ${res.status}`);
}
async function setWindowMaterial(material) {
  const res = await fetch(`${BASE}/window-material`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ material })
  });
  if (!res.ok) throw new Error(`bg-studio window-material ${res.status}`);
  return res.json();
}
function assetUrl(bundleId, path) {
  return `${BASE}/asset?id=${encodeURIComponent(bundleId)}&path=${encodeURIComponent(path)}`;
}
function manifestUrl(bundleId) {
  return assetUrl(bundleId, "manifest.json");
}
async function fetchWallpapers() {
  const payload = await json(`${BASE}/wallpapers`, { cache: "no-store" });
  return payload.wallpapers;
}
async function importWallpaper(dir) {
  const res = await fetch(`${BASE}/wallpapers?dir=${encodeURIComponent(dir)}`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `import ${res.status}`);
  return res.json();
}
async function deleteWallpaper(id) {
  const res = await fetch(`${BASE}/wallpapers?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`bg-studio wallpaper delete ${res.status}`);
}
async function fetchActivity(threshold) {
  return json(`${BASE}/activity?threshold=${encodeURIComponent(String(threshold))}`, { cache: "no-store" });
}
async function scanWorkshop(root) {
  const payload = await json(`${BASE}/we-scan?root=${encodeURIComponent(root)}`, { cache: "no-store" });
  return payload.items;
}
async function importFromWorkshop(root, wid) {
  const res = await fetch(`${BASE}/we-import?root=${encodeURIComponent(root)}&id=${encodeURIComponent(wid)}`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `we-import ${res.status}`);
  return res.json();
}
function isDarkScheme() {
  if (typeof document === "undefined") return false;
  const scheme = getComputedStyle(document.documentElement).colorScheme;
  if (scheme) return scheme.includes("dark");
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}
function subscribeColorScheme(callback) {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {
  };
  const observer = new MutationObserver(callback);
  observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
  return () => observer.disconnect();
}

// src/client/activity.ts
var POLL_MS = 2e3;
var ActivityMachine = class {
  timer = null;
  snapshot = { activeTasks: 0, state: "idle" };
  lastNotified = "";
  idleClips = [];
  idleIndex = 0;
  idleRotateMs = 12e4;
  idleTimer = null;
  /** Current idle clip name (empty string when no clips configured). */
  currentIdleClip = "";
  /** Consumer callback for any change (state or idle rotation). */
  listener = null;
  configure(options) {
    this.idleClips = options.idleClips;
    this.idleRotateMs = Math.max(5, options.idleRotateSec) * 1e3;
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = setInterval(() => this.rotateIdle(), this.idleRotateMs);
    this.idleIndex = 0;
    this.currentIdleClip = this.idleClips[0] ?? "";
  }
  rotateIdle() {
    if (this.idleClips.length <= 1 || this.snapshot.state !== "idle") return;
    this.idleIndex = (this.idleIndex + 1) % this.idleClips.length;
    this.currentIdleClip = this.idleClips[this.idleIndex];
    this.listener?.(this.snapshot);
  }
  start(threshold) {
    if (this.timer) clearInterval(this.timer);
    const tick = () => {
      void fetchActivity(threshold).then((snap) => {
        const before = `${this.snapshot.state}:${this.snapshot.activeTasks}`;
        this.snapshot = snap;
        const after = `${snap.state}:${snap.activeTasks}`;
        if (before !== after) this.notify();
      }).catch(() => {
      });
    };
    tick();
    this.timer = setInterval(tick, POLL_MS);
  }
  notify() {
    const fingerprint = `${this.snapshot.state}:${this.snapshot.activeTasks}:${this.currentIdleClip}`;
    if (fingerprint === this.lastNotified) return;
    this.lastNotified = fingerprint;
    this.listener?.(this.snapshot);
    try {
      window.postMessage({ source: "dsh-bg-studio", type: "activity", state: this.snapshot.state, activeTasks: this.snapshot.activeTasks, idleClip: this.currentIdleClip }, "*");
    } catch {
    }
  }
  onChange(listener) {
    this.listener = listener;
  }
  get state() {
    return this.snapshot.state;
  }
  get activeTasks() {
    return this.snapshot.activeTasks;
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.timer = null;
    this.idleTimer = null;
  }
};

// src/client/theme.ts
function setDshThemePreference(preference) {
  const payload = {
    type: "client-request",
    rpcId: globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random()),
    method: "settings/mutate",
    payload: {
      args: {
        ns: "ui-theme",
        ops: [{ op: "set", path: ["preference"], value: preference }]
      }
    }
  };
  return fetch("api/settings/mutate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  }).then((res) => res.ok).catch(() => false);
}

// src/client/mood.ts
var TOAST_ID = "dsh-bg-studio-mood-toast";
var activeBundle = null;
function resetMoodActivation() {
  activeBundle = null;
}
var EN = {
  toLight: "The wallpaper woke up to daylight, but the UI is still in bed. Open the curtains together?",
  toDark: "The wallpaper has gone stargazing, but the UI left the lights on. Turn them off together?",
  keep: "Keep as is",
  never: "Never ask for this wallpaper"
};
function strings() {
  const zh2 = navigator.language?.toLowerCase().startsWith("zh");
  const zhStrings = {
    toLight: "\u58C1\u7EB8\u5929\u4EAE\u4E86\uFF0C\u754C\u9762\u8FD8\u8D56\u5728\u591C\u91CC\u3002\u8981\u4E00\u8D77\u6380\u5F00\u7A97\u5E18\u5417\uFF1F",
    toDark: "\u58C1\u7EB8\u5DF2\u5165\u591C\uFF0C\u754C\u9762\u8FD8\u4EAE\u7740\u706F\u3002\u8981\u4E00\u8D77\u5173\u706F\u770B\u661F\u661F\u5417\uFF1F",
    keep: "\u4FDD\u6301\u73B0\u72B6",
    never: "\u8FD9\u5F20\u58C1\u7EB8\u4E0D\u518D\u63D0\u9192"
  };
  return zh2 ? zhStrings : EN;
}
function sampleVideoTone(video) {
  try {
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 18;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }
    const luma = sum / (data.length / 4) / 255;
    if (luma > 0.65) return "light";
    if (luma < 0.35) return "dark";
    return null;
  } catch {
    return null;
  }
}
function maybePromptThemeMood(options) {
  const { manifest, settings, video, onMute } = options;
  const bundleId = settings.animated.mediaSource;
  if (!bundleId) return;
  if (bundleId === activeBundle) return;
  activeBundle = bundleId;
  if (settings.animated.perBundle[bundleId]?.moodMuted === true) return;
  let tone = manifest.tone;
  if (!tone && video) tone = sampleVideoTone(video);
  if (!tone) return;
  const dark = isDarkScheme();
  if (tone === "dark" && dark) return;
  if (tone === "light" && !dark) return;
  const s = strings();
  const wantLight = tone === "light";
  const text = wantLight ? s.toLight : s.toDark;
  const buttonLabel = navigator.language?.toLowerCase().startsWith("zh") ? wantLight ? "\u5207\u6362\u5230\u6D45\u8272\u6A21\u5F0F" : "\u5207\u6362\u5230\u6DF1\u8272\u6A21\u5F0F" : wantLight ? "Switch to light mode" : "Switch to dark mode";
  showMoodToast(text, buttonLabel, s.keep, s.never, wantLight, onMute);
}
function showMoodToast(text, switchLabel, keepLabel, neverLabel, wantLight, onMute) {
  dismissMoodToast();
  const dark = isDarkScheme();
  const toast = document.createElement("div");
  toast.id = TOAST_ID;
  toast.style.cssText = [
    "position:fixed",
    "left:50%",
    "bottom:28px",
    "transform:translateX(-50%)",
    "z-index:2147483000",
    "display:flex",
    "align-items:center",
    "gap:12px",
    `background:${dark ? "rgba(24,28,38,0.92)" : "rgba(255,255,255,0.94)"}`,
    `color:${dark ? "#f3f5fa" : "#171a21"}`,
    "padding:12px 16px",
    "border-radius:14px",
    "box-shadow:0 8px 28px rgba(0,0,0,0.35)",
    "backdrop-filter:blur(10px)",
    "font-size:13px",
    "max-width:min(640px, 86vw)"
  ].join(";");
  const msg = document.createElement("span");
  msg.textContent = text;
  msg.style.cssText = "flex:1;line-height:1.5";
  toast.append(msg);
  const mkButton = (label, primary, onClick) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText = [
      "border:none",
      "cursor:pointer",
      "border-radius:8px",
      "padding:7px 13px",
      "font-size:12.5px",
      "white-space:nowrap",
      primary ? `background:${wantLight ? "#2b6cb0" : "#39435c"};color:#fff` : `background:transparent;color:inherit;border:1px solid ${dark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.22)"}`
    ].join(";");
    b.addEventListener("click", () => {
      onClick();
      dismissMoodToast();
    });
    return b;
  };
  toast.append(mkButton(neverLabel, false, onMute));
  toast.append(mkButton(keepLabel, false, () => {
  }));
  toast.append(mkButton(switchLabel, true, () => {
    void setDshThemePreference(wantLight ? "light" : "dark");
  }));
  document.body.append(toast);
  setTimeout(dismissMoodToast, 3e4);
}
function dismissMoodToast() {
  document.getElementById(TOAST_ID)?.remove();
}

// src/client/scenes.ts
var nebulaScene = {
  frame(ctx, w, h, t) {
    const stars = [];
    const rand = (i) => {
      const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 160; i++) {
      stars.push({ x: rand(i) * w, y: rand(i + 500) * h, r: 0.4 + rand(i + 900) * 1.6, p: rand(i + 1300) * Math.PI * 2, s: 2 + rand(i + 1700) * 8 });
    }
    const grad = ctx.createRadialGradient(w * (0.3 + 0.1 * Math.sin(t * 0.05)), h * 0.35, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    grad.addColorStop(0, "rgba(70, 90, 160, 0.28)");
    grad.addColorStop(0.55, "rgba(40, 30, 70, 0.20)");
    grad.addColorStop(1, "rgba(10, 10, 20, 0)");
    ctx.fillStyle = "#0b0d18";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    for (const star of stars) {
      const x = (star.x + t * star.s) % (w + 20) - 10;
      const twinkle = 0.5 + 0.5 * Math.sin(t * 1.4 + star.p);
      ctx.globalAlpha = 0.25 + 0.75 * twinkle;
      ctx.fillStyle = "#dfe8ff";
      ctx.beginPath();
      ctx.arc(x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
};
var CANVAS_SCENES = {
  nebula: nebulaScene
};

// src/client/renderers.ts
var videoRenderer = {
  mount(el, manifest, ctx) {
    el.replaceChildren();
    const video = document.createElement("video");
    video.src = ctx.assetUrl(manifest.entry);
    video.loop = true;
    video.autoplay = true;
    video.setAttribute("playsinline", "");
    video.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
    video.addEventListener("error", () => {
    });
    el.append(video);
    video.__wantVolume = ctx.bundle.volume;
    this.update?.(el, manifest, ctx);
  },
  update(el, _manifest, ctx) {
    const video = el.querySelector("video");
    if (!video) return;
    video.playbackRate = ctx.bundle.rate;
    video.style.objectFit = ctx.bundle.fit;
    const want = ctx.bundle.volume;
    video.__wantVolume = want;
    video.volume = want;
    video.muted = want === 0;
    void video.play().catch(() => {
      video.muted = true;
      void video.play().catch(() => {
      });
      if (!video.__gestureHook) {
        video.__gestureHook = () => {
          video.volume = video.__wantVolume ?? 0;
          video.muted = (video.__wantVolume ?? 0) === 0;
          void video.play().catch(() => {
          });
        };
        window.addEventListener("pointerdown", video.__gestureHook, { once: true });
        window.addEventListener("keydown", video.__gestureHook, { once: true });
      }
    });
  }
};
var webRenderer = {
  mount(el, manifest, ctx) {
    el.replaceChildren();
    const frame = document.createElement("iframe");
    frame.src = ctx.assetUrl(manifest.entry);
    frame.setAttribute("sandbox", "allow-scripts allow-pointer-lock");
    frame.style.cssText = `width:100%;height:100%;border:0;display:block;background:${ctx.isDark() ? "#101318" : "#f2f4f8"}`;
    el.append(frame);
  },
  setState(el, state, clip) {
    for (const frame of el.querySelectorAll("iframe")) {
      try {
        frame.contentWindow?.postMessage({ source: "dsh-bg-studio", type: "activity", state, idleClip: clip }, "*");
      } catch {
      }
    }
  }
};
var canvasRenderer = {
  mount(el, manifest) {
    el.replaceChildren();
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%;height:100%;display:block";
    el.append(canvas);
    const ctx2d = canvas.getContext("2d");
    const sceneName = manifest.entry.replace(/^scene:/, "");
    const scene = CANVAS_SCENES[sceneName];
    if (!ctx2d || !scene) return;
    const state = { raf: 0, start: performance.now() };
    const draw = () => {
      const rect = el.getBoundingClientRect();
      if (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height)) {
        canvas.width = Math.max(1, Math.round(rect.width));
        canvas.height = Math.max(1, Math.round(rect.height));
      }
      scene.frame(ctx2d, canvas.width, canvas.height, (performance.now() - state.start) / 1e3);
      state.raf = requestAnimationFrame(draw);
    };
    draw();
    el.__bgStudioRaf = state.raf;
    const stop = () => cancelAnimationFrame(state.raf);
    el.__bgStudioStop = stop;
  },
  dispose(el) {
    ;
    el.__bgStudioStop?.();
  }
};
var characterRenderer = {
  mount(el, manifest, ctx) {
    el.replaceChildren();
    const dom = {
      canvas: document.createElement("canvas"),
      ctx2d: null,
      image: new Image(),
      spec: { sheet: "", frameW: 128, frameH: 128, fps: 12, clips: {} },
      clip: "",
      frameIndex: 0,
      lastFrameAt: 0,
      raf: 0,
      ready: false
    };
    dom.canvas.style.cssText = "width:100%;height:100%;display:block";
    dom.ctx2d = dom.canvas.getContext("2d");
    el.append(dom.canvas);
    el.__bgStudioChar = dom;
    void fetch(ctx.assetUrl(manifest.entry)).then((res) => res.ok ? res.json() : Promise.reject(new Error(`mascot.json ${res.status}`))).then((spec) => {
      if (!dom.canvas.isConnected) return;
      dom.spec = spec;
      dom.image.src = ctx.assetUrl(spec.sheet);
      void dom.image.decode().catch(() => {
      });
      dom.ready = true;
      drawCharacter(el, 0);
    }).catch(() => {
    });
  },
  setState(el, _state, clip) {
    const dom = el.__bgStudioChar;
    if (!dom || !dom.ready || !dom.spec.clips[clip] || dom.clip === clip) return;
    dom.clip = clip;
    dom.frameIndex = 0;
  },
  update(el, manifest, ctx) {
    this.mount?.(el, manifest, ctx);
  },
  dispose(el) {
    const dom = el.__bgStudioChar;
    if (dom) cancelAnimationFrame(dom.raf);
  }
};
function drawCharacter(el, timestamp) {
  const dom = el.__bgStudioChar;
  if (!dom) return;
  const clip = dom.spec.clips[dom.clip] ?? Object.values(dom.spec.clips)[0];
  if (dom.ready && clip && dom.image.complete && dom.image.naturalWidth > 0) {
    const rect = el.getBoundingClientRect();
    if (dom.canvas.width !== Math.round(rect.width) || dom.canvas.height !== Math.round(rect.height)) {
      dom.canvas.width = Math.max(1, Math.round(rect.width));
      dom.canvas.height = Math.max(1, Math.round(rect.height));
    }
    const frameMs = 1e3 / Math.max(1, dom.spec.fps);
    if (timestamp - dom.lastFrameAt >= frameMs) {
      dom.lastFrameAt = timestamp;
      dom.frameIndex = (dom.frameIndex + 1) % Math.max(1, clip[1] - clip[0]);
    }
    const { frameW, frameH } = dom.spec;
    const cols = Math.max(1, Math.floor(dom.image.naturalWidth / frameW));
    const index = clip[0] + dom.frameIndex;
    const sx = index % cols * frameW;
    const sy = Math.floor(index / cols) * frameH;
    const scale = 2;
    const dw = frameW * scale;
    const dh = frameH * scale;
    dom.ctx2d.clearRect(0, 0, dom.canvas.width, dom.canvas.height);
    dom.ctx2d.drawImage(dom.image, sx, sy, frameW, frameH, (dom.canvas.width - dw) / 2, dom.canvas.height - dh, dw, dh);
  }
  dom.raf = requestAnimationFrame((t) => drawCharacter(el, t));
}

// src/client/providers/animated.ts
var RENDERERS = {
  video: videoRenderer,
  web: webRenderer,
  canvas: canvasRenderer,
  character: characterRenderer
};
var activity = new ActivityMachine();
function bundleSettingsOf(settings) {
  const id = settings.animated.mediaSource;
  return id && settings.animated.perBundle[id] || DEFAULT_BUNDLE_SETTINGS;
}
var animatedProvider = {
  mount(el, settings, pageCtx) {
    el.replaceChildren();
    const dom = { manifest: null, renderer: null };
    el.__bgStudioAnim = dom;
    const bundle = bundleSettingsOf(settings);
    const ctx = {
      assetUrl: (path) => pageCtx.assetUrl(settings.animated.mediaSource ?? "", path),
      isDark: pageCtx.isDark,
      bundle
    };
    void fetchManifest(settings, pageCtx).then((manifest) => {
      if (!manifest || !el.isConnected) return;
      dom.manifest = manifest;
      dom.renderer = RENDERERS[manifest.type];
      if (!dom.renderer) return;
      dom.renderer.mount(el, manifest, ctx);
      const prompt = (video) => {
        try {
          maybePromptThemeMood({
            manifest,
            settings,
            video,
            onMute: () => pageCtx.muteMoodPrompt(settings.animated.mediaSource ?? "")
          });
        } catch {
        }
      };
      if (manifest.tone || manifest.type !== "video") {
        prompt(null);
      } else {
        const video = el.querySelector("video");
        const trySample = () => {
          const v = video;
          if (!v || v.__moodTried) return;
          if (v.readyState >= 2) {
            v.__moodTried = true;
            prompt(v);
          } else {
            setTimeout(trySample, 1200);
          }
        };
        setTimeout(trySample, 1500);
      }
      if (manifest.type === "character" || manifest.type === "web") {
        const clips = manifest.states?.idle ?? [];
        activity.configure({
          threshold: bundle.taskThreshold,
          idleClips: clips,
          idleRotateSec: bundle.idleRotateSec
        });
        activity.onChange((snap) => {
          const clip2 = snap.state === "idle" ? activity.currentIdleClip : (manifest.states?.[snap.state] ?? [])[0] ?? "";
          dom.renderer?.setState?.(el, snap.state, clip2);
        });
        activity.start(bundle.taskThreshold);
        const clip = activity.state === "idle" ? activity.currentIdleClip || clips[0] || "" : (manifest.states?.[activity.state] ?? [])[0] ?? "";
        dom.renderer.setState?.(el, activity.state, clip);
      }
    }).catch(() => {
    });
  },
  update(el, settings, pageCtx) {
    this.mount?.(el, settings, pageCtx);
  },
  dispose(el) {
    const dom = el.__bgStudioAnim;
    dom?.renderer?.dispose?.(el);
    activity.stop();
    resetMoodActivation();
  }
};
var manifestCache = /* @__PURE__ */ new Map();
function fetchManifest(settings, pageCtx) {
  const id = settings.animated.mediaSource;
  if (!id) return Promise.resolve(null);
  const cached = manifestCache.get(id);
  if (cached && Date.now() - cached.at < 6e4) return Promise.resolve(cached.manifest);
  return fetch(pageCtx.manifestUrl(id), { cache: "no-store" }).then((res) => res.ok ? res.json() : Promise.reject(new Error(String(res.status)))).then((manifest) => {
    manifestCache.set(id, { manifest, at: Date.now() });
    return manifest;
  }).catch(() => null);
}

// src/client/background.ts
var PROVIDERS = {
  image: imageProvider,
  transparent: transparentProvider,
  frosted: frostedProvider,
  animated: animatedProvider
};
var LAYER_ID = "dsh-bg-studio-layer";
var BackgroundLayer = class {
  el = null;
  activeKind = null;
  ensureLayer() {
    if (this.el && this.el.isConnected) return this.el;
    const el = document.createElement("div");
    el.id = LAYER_ID;
    el.className = "dsh-bg-studio-layer";
    document.body.insertBefore(el, document.body.firstChild);
    this.el = el;
    return el;
  }
  /** Switch mode / refresh parameters. Cheap: same-kind updates call
   * provider.update instead of remounting (future animated content must not
   * restart on slider drags). */
  setSettings(settings, ctx) {
    if (typeof document === "undefined") return;
    if (settings.kind === "none") {
      this.dispose();
      return;
    }
    const el = this.ensureLayer();
    const provider = PROVIDERS[settings.kind];
    if (!provider) return;
    if (this.activeKind === settings.kind) {
      provider.update?.(el, settings, ctx);
      return;
    }
    if (this.activeKind !== null) {
      PROVIDERS[this.activeKind]?.dispose?.(el);
      el.replaceChildren();
    }
    this.activeKind = settings.kind;
    try {
      provider.mount(el, settings, ctx);
    } catch {
      el.replaceChildren();
      this.activeKind = null;
    }
  }
  dispose() {
    if (this.el) {
      if (this.activeKind !== null) {
        try {
          PROVIDERS[this.activeKind]?.dispose?.(this.el);
        } catch {
        }
      }
      this.el.remove();
      this.el = null;
    }
    this.activeKind = null;
  }
};

// src/client/surface.ts
var STYLE_ID = "dsh-bg-studio-surface-style";
var WHITE = [255, 255, 255];
var SURFACE_TOKENS = [
  { name: "--dsw-alias-bg-base", dark: [21, 21, 23], light: WHITE },
  { name: "--dsw-alias-bg-layer-1", dark: [35, 35, 36], light: WHITE, stacked: true },
  { name: "--dsw-alias-bg-layer-2", dark: [44, 44, 46], light: WHITE, stacked: true },
  { name: "--dsw-alias-bg-layer-3", dark: [53, 54, 56], light: WHITE, stacked: true },
  { name: "--dsw-alias-bg-module-platform", dark: [53, 54, 56], light: [245, 246, 247], stacked: true },
  { name: "--dsw-alias-bg-multi-select", dark: [33, 33, 35], light: [245, 246, 247], stacked: true },
  { name: "--dsw-alias-markdown-code-block", dark: [27, 27, 28], light: [249, 250, 251] },
  { name: "--dsw-alias-markdown-inline-code", dark: [41, 41, 41], light: [250, 250, 250] },
  { name: "--dsw-alias-settings-card-fill", dark: [44, 44, 46], light: WHITE },
  { name: "--dsw-alias-onboarding-card-fill", dark: [44, 44, 46], light: WHITE, stockAlpha: 0.8 },
  { name: "--dsw-specific-bubble", dark: [44, 44, 46], light: [237, 243, 254] },
  { name: "--dsw-specific-input-major", dark: [44, 44, 46], light: WHITE, stacked: true },
  { name: "--dsw-specific-login-input", dark: [27, 27, 28], light: [249, 250, 251] },
  { name: "--dsw-specific-sidebar-fill", dark: [27, 27, 28], light: [249, 250, 251], stacked: true }
];
function alphaColor(token, dark, alpha) {
  const rgb = dark ? token.dark : token.light;
  const effective = Math.round((token.stockAlpha ?? 1) * alpha * 100) / 100;
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]} / ${effective})`;
}
function surfaceCss(settings, dark) {
  const { kind, transparent, frosted } = settings;
  const lines = [];
  lines.push([
    ".dsh-bg-studio-layer {",
    "  position: fixed;",
    "  inset: 0;",
    "  z-index: 0;",
    "  pointer-events: none;",
    "  overflow: hidden;",
    "}",
    ".dsh-bg-studio-layer > * { position: absolute; inset: 0; }"
  ].join("\n"));
  if (kind === "none") return lines.join("\n");
  lines.push("body[data-dsh-bg-kind] { background: transparent; }");
  lines.push([
    "body[data-dsh-bg-kind][data-dsh-bg-sysdialog='opaque'] [data-shortcut-modal] {",
    `  background-color: ${dark ? "rgb(44 44 46)" : "rgb(255 255 255)"};`,
    "}"
  ].join("\n"));
  const baseAlpha = 0;
  const surfaceAlpha = kind === "transparent" ? transparent.surfaceOpacity : kind === "frosted" ? frosted.surfaceOpacity : 0;
  const stackedAlpha = surfaceAlpha > 0 ? 1 - Math.sqrt(1 - surfaceAlpha) : 0;
  lines.push(`body[data-dsh-bg-kind="${kind}"] {`);
  for (const token of SURFACE_TOKENS) {
    const alpha = token.name === "--dsw-alias-bg-base" ? baseAlpha : token.stacked ? stackedAlpha : surfaceAlpha;
    lines.push(`  ${token.name}: ${alphaColor(token, dark, alpha)};`);
  }
  lines.push("}");
  return lines.join("\n");
}
function applySurfaceStyle(settings, dark) {
  if (typeof document === "undefined") return;
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.append(style);
  }
  style.textContent = surfaceCss(settings, dark);
  const body = document.body;
  if (body) {
    if (settings.kind === "none") body.removeAttribute("data-dsh-bg-kind");
    else body.setAttribute("data-dsh-bg-kind", settings.kind);
  }
}
function removeSurfaceStyle() {
  document.getElementById(STYLE_ID)?.remove();
  document.body?.removeAttribute("data-dsh-bg-kind");
  document.body?.removeAttribute("data-dsh-bg-panel");
  document.body?.removeAttribute("data-dsh-bg-sysdialog");
}

// src/client/runtime.ts
var PERSIST_DEBOUNCE_MS = 350;
var BgStudioRuntime = class {
  settings = null;
  images = [];
  wallpapers = [];
  weCache = null;
  layer = new BackgroundLayer();
  saveTimer = null;
  offScheme = null;
  /** DWM material verdict: 'unknown' until first try, then 'ok'/'unavailable'. */
  materialSupport = "unknown";
  materialNow = null;
  providerCtx = {
    imageUrl,
    assetUrl,
    manifestUrl,
    isDark: isDarkScheme,
    onSchemeChange: subscribeColorScheme,
    muteMoodPrompt: (bundleId) => this.updateBundleSettings(bundleId, { moodMuted: true })
  };
  /** Panels re-render on state changes (settings swaps, library edits). */
  listeners = /* @__PURE__ */ new Set();
  get current() {
    return this.settings;
  }
  get library() {
    return this.images;
  }
  get wallpaperLibrary() {
    return this.wallpapers;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit() {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {
      }
    }
  }
  paint() {
    if (!this.settings) return;
    applySurfaceStyle(this.settings, isDarkScheme());
    this.layer.setSettings(this.settings, this.providerCtx);
    if (document.body) {
      document.body.setAttribute("data-dsh-bg-panel", this.settings.panelOpaque === false ? "clear" : "opaque");
      document.body.setAttribute("data-dsh-bg-sysdialog", this.settings.systemDialogsOpaque === false ? "clear" : "opaque");
    }
    void this.syncWindowMaterial(this.settings.kind);
  }
  /** Best-effort: transparent mode asks the desktop window for the Win11
   * acrylic material (so cleared surfaces reveal the desktop); any other
   * mode restores the stock opaque backing. Unsupported hosts answer once
   * and we stop asking. */
  async syncWindowMaterial(kind) {
    const want = kind === "transparent" ? "acrylic" : "none";
    if (this.materialNow === want) return;
    try {
      const result = await setWindowMaterial(want);
      if (result.ok) {
        this.materialNow = want;
        if (this.materialSupport !== "ok") {
          this.materialSupport = "ok";
          this.emit();
        }
      } else if (want === "acrylic") {
        if (this.materialSupport !== "unavailable") {
          this.materialSupport = "unavailable";
          this.emit();
        }
        this.materialNow = this.materialNow ?? "none";
      }
    } catch {
    }
  }
  /** Boot: load settings and paint. Scheme flips repaint (dark gradient
   * variants). Safe to call before body exists (waits for DOMContentLoaded). */
  async start() {
    try {
      const payload = await fetchSettings();
      this.settings = payload.settings;
      this.images = payload.images;
    } catch {
      return;
    }
    const begin = () => {
      this.paint();
      this.offScheme = subscribeColorScheme(() => this.paint());
    };
    if (document.body) begin();
    else document.addEventListener("DOMContentLoaded", begin, { once: true });
    void this.refreshWallpapers();
    this.emit();
  }
  /** Reload the wallpaper-bundle listing (after start / import / delete). */
  async refreshWallpapers() {
    try {
      this.wallpapers = await fetchWallpapers();
    } catch {
      this.wallpapers = [];
    }
    this.emit();
  }
  /** Import a bundle from a local directory and select it. */
  async addWallpaper(dir) {
    await importWallpaper(dir);
    await this.refreshWallpapers();
    if (this.settings && this.settings.kind === "animated" && !this.settings.animated.mediaSource) {
      this.update({ animated: { ...this.settings.animated, mediaSource: this.wallpapers[this.wallpapers.length - 1]?.id ?? null } });
    }
  }
  async removeWallpaper(id) {
    await deleteWallpaper(id);
    if (this.settings?.animated.mediaSource === id) {
      this.update({ animated: { ...this.settings.animated, mediaSource: null } });
    }
    await this.refreshWallpapers();
  }
  /** Patch one bundle's wallpaper-local settings (the ⚙ values). */
  updateBundleSettings(bundleId, patch) {
    if (!this.settings) return;
    const current = this.settings.animated.perBundle[bundleId] ?? DEFAULT_BUNDLE_SETTINGS;
    const next = sanitizeBundleSettings({ ...current, ...patch });
    this.update({ animated: { ...this.settings.animated, perBundle: { ...this.settings.animated.perBundle, [bundleId]: next } } });
  }
  /** Scan a Wallpaper Engine workshop directory (cached per root). */
  async scanWorkshop(root) {
    if (this.weCache?.root === root) return this.weCache.items;
    const items = await scanWorkshop(root);
    this.weCache = { root, items };
    return items;
  }
  /** Convert-and-import one workshop wallpaper into the library. */
  async importFromWorkshop(root, wid) {
    await importFromWorkshop(root, wid);
    this.weCache = null;
    await this.refreshWallpapers();
  }
  /** Apply a patch locally now, persist debounced. */
  update(patch) {
    if (!this.settings) return;
    this.settings = { ...this.settings, ...patch };
    this.paint();
    this.emit();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void saveSettings(this.settings).catch(() => {
      });
    }, PERSIST_DEBOUNCE_MS);
  }
  async reset() {
    try {
      const payload = await resetSettings();
      this.settings = payload.settings;
      this.images = payload.images;
    } catch {
      return;
    }
    this.paint();
    this.emit();
  }
  /** Reset ONLY the current mode's parameters to that mode's defaults —
   * the mode itself and the chosen library image stay, so a slider run
   * too far is always one click from sane values. */
  resetMode() {
    if (!this.settings) return;
    const kind = this.settings.kind;
    if (kind === "none") return;
    const patch = { [kind]: { ...DEFAULT_SETTINGS[kind] } };
    if (kind === "image" && this.settings.image.imageId) {
      patch.image = { ...DEFAULT_SETTINGS.image, imageId: this.settings.image.imageId };
    }
    if (kind === "frosted" && this.settings.frosted.imageId) {
      patch.frosted = { ...DEFAULT_SETTINGS.frosted, imageId: this.settings.frosted.imageId };
    }
    this.update(patch);
  }
  async addImage(file) {
    const { id } = await uploadImage(file);
    this.images = [{ id, name: file.name, bytes: file.size, mime: file.type, addedAt: Date.now() }, ...this.images];
    if (this.settings?.kind === "image" && !this.settings.image.imageId) {
      this.update({ image: { ...this.settings.image, imageId: id } });
    } else {
      this.emit();
    }
  }
  async removeImage(id) {
    await deleteImage(id);
    this.images = this.images.filter((entry) => entry.id !== id);
    if (this.settings) {
      const image = this.settings.image.imageId === id ? { ...this.settings.image, imageId: null } : this.settings.image;
      const frosted = this.settings.frosted.imageId === id ? { ...this.settings.frosted, imageId: null } : this.settings.frosted;
      this.update({ image, frosted });
    } else {
      this.emit();
    }
  }
  dispose() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.offScheme?.();
    this.layer.dispose();
    removeSurfaceStyle();
    if (this.materialNow === "acrylic") void setWindowMaterial("none").catch(() => {
    });
    this.listeners.clear();
  }
};

// src/client/panel/PanelPage.tsx
var import_react = require("react");

// src/client/locales.ts
var en = {
  "panel.title": "Background Studio",
  "panel.subtitle": "Custom backgrounds for the app window. Text colors always follow your light/dark theme.",
  "mode.none": "Default",
  "mode.none.hint": "Stock DSH appearance, nothing changed.",
  "mode.image": "Picture",
  "mode.image.hint": "Your own image under everything.",
  "mode.transparent": "Transparent",
  "mode.transparent.hint": "Experimental: full see-through (the Windows desktop app shows the window color).",
  "mode.frosted": "Frosted glass",
  "mode.frosted.hint": "Blurred glass surfaces.",
  "mode.animated": "Animated",
  "mode.animated.hint": "Wallpaper bundles: video, web, canvas scenes, task-reactive characters.",
  "section.library": "Image library",
  "library.empty": "No images yet. Add one to use picture or frosted backgrounds.",
  "library.add": "Add image\u2026",
  "library.delete": "Delete",
  "library.used": "In use",
  "image.fit": "Fit",
  "image.fit.cover": "Fill window",
  "image.fit.contain": "Fit inside",
  "image.fit.tile": "Tile",
  "image.opacity": "Image opacity",
  "image.blur": "Image blur",
  "image.dim": "Darken for readability",
  "image.tint": "Scrim color",
  "image.tint.auto": "auto black",
  "image.tint.custom": "custom",
  "transparent.surfaceOpacity": "Surface fill kept",
  "transparent.scrim": "Readability scrim",
  "transparent.note": "Surfaces become see-through. On the desktop app with Windows 11, the window also gets the system acrylic material so you see the desktop through it; otherwise you see the window color.",
  "transparent.material.ok": "System window material active \u2014 cleared surfaces reveal the desktop.",
  "transparent.material.unavailable": "System window material unavailable here (needs the desktop app on Windows 11) \u2014 cleared surfaces show the window color.",
  "frosted.blur": "Glass blur",
  "frosted.surfaceOpacity": "Glass fill",
  "frosted.saturation": "Color richness",
  "frosted.image": "Backdrop image (optional)",
  "frosted.image.auto": "Built-in gradient",
  "panel.opaque": "Keep the settings panel opaque",
  "panel.sysOpaque": "Keep DSH dialogs opaque",
  "action.reset": "Reset current mode",
  "action.offline": "Plugin host unreachable \u2014 changes cannot be saved.",
  "wallpaper.library": "Wallpaper bundles",
  "wallpaper.import": "Import",
  "wallpaper.dirPlaceholder": "Local folder containing manifest.json\u2026",
  "wallpaper.empty": "No bundles yet. Import a folder with a manifest.json (format dsh-wallpaper/1) \u2014 video, web page, canvas scene, or character.",
  "wallpaper.bad": "manifest invalid",
  "wallpaper.threshold": "Busy threshold (tasks)",
  "wallpaper.rotate": "Idle clip rotation",
  "wallpaper.reducedMotion": "Freeze when OS requests reduced motion",
  "wallpaper.note": "Click a card to activate; double-click (or the gear) for that wallpaper's own settings. Video bundles get volume/speed/fit; character bundles get busy-threshold and idle rotation.",
  "wallpaper.settings": "Wallpaper settings",
  "wp.volume": "Volume",
  "wp.rate": "Speed",
  "wp.fit": "Fit",
  "wp.fit.fill": "Stretch",
  "wp.noSettings": "This wallpaper type has no settings yet.",
  "we.title": "Import from Wallpaper Engine",
  "we.rootPlaceholder": "Workshop content folder (\u2026\\steamapps\\workshop\\content\\431960)\u2026",
  "we.scan": "Scan",
  "we.importOne": "Import",
  "we.none": "No convertible wallpapers (video/web) in that folder.",
  "action.saved": "Changes apply instantly and are saved automatically."
};
var zh = {
  "panel.title": "\u80CC\u666F\u5DE5\u4F5C\u5BA4",
  "panel.subtitle": "\u81EA\u7531\u66F4\u6362\u5E94\u7528\u80CC\u666F\u3002\u5B57\u4F53\u989C\u8272\u59CB\u7EC8\u8DDF\u968F\u6DF1\u6D45\u8272\u4E3B\u9898\uFF0C\u4E0D\u53D7\u5F71\u54CD\u3002",
  "mode.none": "\u9ED8\u8BA4",
  "mode.none.hint": "DSH \u539F\u751F\u5916\u89C2\uFF0C\u4E0D\u505A\u4EFB\u4F55\u66F4\u6539\u3002",
  "mode.image": "\u56FE\u7247",
  "mode.image.hint": "\u628A\u81EA\u5B9A\u4E49\u56FE\u7247\u94FA\u5728\u6240\u6709\u5185\u5BB9\u4E4B\u4E0B\u3002",
  "mode.transparent": "\u900F\u660E",
  "mode.transparent.hint": "\u5B9E\u9A8C\u6027\uFF1A\u8868\u9762\u5168\u900F\uFF08Windows \u684C\u9762\u7248\u900F\u51FA\u7A97\u53E3\u5E95\u8272\uFF09\u3002",
  "mode.frosted": "\u6BDB\u73BB\u7483",
  "mode.frosted.hint": "\u8868\u9762\u5448\u78E8\u7802\u73BB\u7483\u8D28\u611F\u3002",
  "mode.animated": "\u52A8\u6001",
  "mode.animated.hint": "\u58C1\u7EB8\u5305\uFF1A\u89C6\u9891\u3001\u7F51\u9875\u3001\u7F16\u7A0B\u573A\u666F\u3001\u968F\u4EFB\u52A1\u8054\u52A8\u7684\u89D2\u8272\u3002",
  "section.library": "\u56FE\u7247\u5E93",
  "library.empty": "\u8FD8\u6CA1\u6709\u56FE\u7247\u3002\u6DFB\u52A0\u4E00\u5F20\uFF0C\u5373\u53EF\u7528\u4E8E\u56FE\u7247\u6216\u6BDB\u73BB\u7483\u80CC\u666F\u3002",
  "library.add": "\u6DFB\u52A0\u56FE\u7247\u2026",
  "library.delete": "\u5220\u9664",
  "library.used": "\u4F7F\u7528\u4E2D",
  "image.fit": "\u586B\u5145\u65B9\u5F0F",
  "image.fit.cover": "\u94FA\u6EE1\u7A97\u53E3",
  "image.fit.contain": "\u5B8C\u6574\u663E\u793A",
  "image.fit.tile": "\u5E73\u94FA",
  "image.opacity": "\u56FE\u7247\u4E0D\u900F\u660E\u5EA6",
  "image.blur": "\u56FE\u7247\u6A21\u7CCA",
  "image.dim": "\u538B\u6697\uFF08\u4FDD\u8BC1\u53EF\u8BFB\uFF09",
  "image.tint": "\u906E\u7F69\u989C\u8272",
  "image.tint.auto": "\u81EA\u52A8\u9ED1",
  "image.tint.custom": "\u81EA\u5B9A\u4E49",
  "transparent.surfaceOpacity": "\u8868\u9762\u4FDD\u7559\u5E95\u8272",
  "transparent.scrim": "\u53EF\u8BFB\u6027\u8499\u5C42",
  "transparent.note": "\u8868\u9762\u5C06\u53D8\u4E3A\u900F\u660E\u3002\u684C\u9762\u7248 + Windows 11 \u65F6\u4F1A\u5C1D\u8BD5\u4E3A\u7A97\u53E3\u542F\u7528\u7CFB\u7EDF\u4E9A\u514B\u529B\u6750\u8D28\uFF08\u8868\u9762\u900F\u660E\u540E\u53EF\u900F\u89C6\u684C\u9762\uFF09\uFF1B\u5176\u4F59\u73AF\u5883\u900F\u51FA\u7A97\u53E3\u5E95\u8272\u3002",
  "transparent.material.ok": "\u7CFB\u7EDF\u7A97\u53E3\u6750\u8D28\u5DF2\u751F\u6548\u2014\u2014\u8868\u9762\u900F\u660E\u540E\u53EF\u89C1\u684C\u9762\u3002",
  "transparent.material.unavailable": "\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u7CFB\u7EDF\u7A97\u53E3\u6750\u8D28\uFF08\u9700\u684C\u9762\u7248 + Windows 11\uFF09\u2014\u2014\u8868\u9762\u900F\u660E\u540E\u900F\u51FA\u7A97\u53E3\u5E95\u8272\u3002",
  "frosted.blur": "\u73BB\u7483\u6A21\u7CCA\u5EA6",
  "frosted.surfaceOpacity": "\u73BB\u7483\u5E95\u8272\u6D53\u5EA6",
  "frosted.saturation": "\u80CC\u666F\u8272\u5F69\u9971\u548C",
  "frosted.image": "\u73BB\u7483\u80CC\u540E\u56FE\u7247\uFF08\u53EF\u9009\uFF09",
  "frosted.image.auto": "\u5185\u7F6E\u6E10\u53D8",
  "panel.opaque": "\u8BBE\u7F6E\u9762\u677F\u4FDD\u6301\u4E0D\u900F\u660E",
  "panel.sysOpaque": "\u7CFB\u7EDF\u8BBE\u7F6E\u9875\u4FDD\u6301\u4E0D\u900F\u660E",
  "action.reset": "\u91CD\u7F6E\u5F53\u524D\u6A21\u5F0F\u53C2\u6570",
  "action.offline": "\u63D2\u4EF6\u540E\u53F0\u670D\u52A1\u4E0D\u53EF\u8FBE\u2014\u2014\u6682\u65F6\u65E0\u6CD5\u4FDD\u5B58\u66F4\u6539\u3002",
  "wallpaper.library": "\u58C1\u7EB8\u5305",
  "wallpaper.import": "\u5BFC\u5165",
  "wallpaper.dirPlaceholder": "\u5305\u542B manifest.json \u7684\u672C\u5730\u6587\u4EF6\u5939\u8DEF\u5F84\u2026",
  "wallpaper.empty": "\u8FD8\u6CA1\u6709\u58C1\u7EB8\u5305\u3002\u5BFC\u5165\u4E00\u4E2A\u542B manifest.json\uFF08\u683C\u5F0F dsh-wallpaper/1\uFF09\u7684\u6587\u4EF6\u5939\u2014\u2014\u89C6\u9891\u3001\u7F51\u9875\u3001\u7F16\u7A0B\u573A\u666F\u6216\u89D2\u8272\u5305\u5747\u53EF\u3002",
  "wallpaper.bad": "\u6E05\u5355\u65E0\u6548",
  "wallpaper.threshold": "\u5FD9\u788C\u9608\u503C\uFF08\u4EFB\u52A1\u6570\uFF09",
  "wallpaper.rotate": "\u6478\u9C7C\u52A8\u4F5C\u8F6E\u6362\u95F4\u9694",
  "wallpaper.reducedMotion": "\u7CFB\u7EDF\u8981\u6C42\u51CF\u5C11\u52A8\u6001\u65F6\u51BB\u7ED3\u58C1\u7EB8",
  "wallpaper.note": "\u5355\u51FB\u5361\u7247\u542F\u7528\uFF1B\u53CC\u51FB\u5361\u7247\uFF08\u6216\u70B9 \u2699\uFF09\u6253\u5F00\u8BE5\u58C1\u7EB8\u81EA\u5DF1\u7684\u8BBE\u7F6E\u3002\u89C6\u9891\u58C1\u7EB8\u53EF\u8C03\u97F3\u91CF/\u901F\u5EA6/\u9002\u914D\uFF1B\u89D2\u8272\u58C1\u7EB8\u53EF\u8C03\u5FD9\u788C\u9608\u503C\u548C\u6478\u9C7C\u8F6E\u6362\u3002",
  "wallpaper.settings": "\u58C1\u7EB8\u8BBE\u7F6E",
  "wp.volume": "\u97F3\u91CF",
  "wp.rate": "\u64AD\u653E\u901F\u5EA6",
  "wp.fit": "\u753B\u9762\u9002\u914D",
  "wp.fit.fill": "\u62C9\u4F38",
  "wp.noSettings": "\u8BE5\u7C7B\u578B\u58C1\u7EB8\u6682\u65E0\u8BBE\u7F6E\u9879\u3002",
  "we.title": "\u4ECE Wallpaper Engine \u5BFC\u5165",
  "we.rootPlaceholder": "Workshop \u5185\u5BB9\u6587\u4EF6\u5939\uFF08\u2026\\steamapps\\workshop\\content\\431960\uFF09\u2026",
  "we.scan": "\u626B\u63CF",
  "we.importOne": "\u5BFC\u5165",
  "we.none": "\u8BE5\u6587\u4EF6\u5939\u6CA1\u6709\u53EF\u8F6C\u6362\u7684\u58C1\u7EB8\uFF08\u4EC5\u652F\u6301\u89C6\u9891/\u7F51\u9875\u578B\uFF09\u3002",
  "action.saved": "\u66F4\u6539\u5373\u65F6\u751F\u6548\u5E76\u81EA\u52A8\u4FDD\u5B58\u3002"
};

// src/client/panel/panel.css
var panel_default = "/* Background Studio panel. All classes prefixed bg-studio- (plain CSS,\n   injected as a style element \u2014 no CSS-module machinery, no build magic). */\n\n/* The view shell's opaque base is painted INLINE by the panel component\n   (load-order- and cache-proof); these rules are only the CSS fallback.\n   The center column clips overflow (overflow-y: hidden), so the panel must\n   scroll ITSELF: fixed viewport height + own scrollbar. */\n.bg-studio-view {\n  height: 100vh;\n  overflow-y: auto;\n  padding: 20px 0 48px;\n  background: #f9fafb;\n}\n\n.bg-studio-view::-webkit-scrollbar {\n  width: 8px;\n}\n\n.bg-studio-view::-webkit-scrollbar-thumb {\n  background: color-mix(in srgb, currentColor 18%, transparent);\n  border-radius: 4px;\n}\n\n.bg-studio-tint-clear {\n  width: 26px;\n  padding: 5px 0;\n  text-align: center;\n  line-height: 1;\n}\n\nbody[data-ds-dark-theme] .bg-studio-view {\n  background: #151517;\n}\n\n.bg-studio-check {\n  display: inline-flex;\n  align-items: center;\n  gap: 7px;\n  font-size: 12.5px;\n  cursor: pointer;\n  user-select: none;\n}\n\n.bg-studio-check input {\n  accent-color: currentColor;\n}\n\n.bg-studio-inner {\n  max-width: 720px;\n  margin: 0 auto;\n  padding: 0 22px;\n  display: flex;\n  flex-direction: column;\n  gap: 18px;\n  font-size: 13px;\n  line-height: 1.55;\n}\n\n.bg-studio-header h2 {\n  margin: 0 0 4px;\n  font-size: 17px;\n}\n\n.bg-studio-header p {\n  margin: 0;\n  opacity: 0.75;\n  font-size: 12.5px;\n}\n\n/* Mode cards */\n.bg-studio-modes {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));\n  gap: 10px;\n}\n\n.bg-studio-mode {\n  text-align: left;\n  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);\n  border-radius: 10px;\n  padding: 10px 12px;\n  background: transparent;\n  cursor: pointer;\n  font: inherit;\n  color: inherit;\n  display: flex;\n  flex-direction: column;\n  gap: 3px;\n  transition: border-color 0.15s ease, background 0.15s ease;\n}\n\n.bg-studio-mode:hover {\n  border-color: color-mix(in srgb, currentColor 40%, transparent);\n}\n\n.bg-studio-mode[data-active='true'] {\n  border-color: color-mix(in srgb, currentColor 65%, transparent);\n  background: color-mix(in srgb, currentColor 8%, transparent);\n}\n\n.bg-studio-mode[data-disabled='true'] {\n  opacity: 0.45;\n  cursor: default;\n}\n\n.bg-studio-mode .bg-studio-mode-name {\n  font-weight: 600;\n}\n\n.bg-studio-mode .bg-studio-mode-hint {\n  font-size: 11.5px;\n  opacity: 0.7;\n}\n\n/* Sections and controls */\n.bg-studio-section {\n  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);\n  border-radius: 12px;\n  padding: 14px 16px;\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n\n.bg-studio-section h3 {\n  margin: 0;\n  font-size: 13px;\n  font-weight: 600;\n}\n\n.bg-studio-field {\n  display: grid;\n  grid-template-columns: 150px 1fr 52px;\n  align-items: center;\n  gap: 10px;\n}\n\n.bg-studio-field label {\n  font-size: 12.5px;\n}\n\n.bg-studio-field .bg-studio-value {\n  text-align: right;\n  font-variant-numeric: tabular-nums;\n  font-size: 12px;\n  opacity: 0.8;\n}\n\n.bg-studio-field input[type='range'] {\n  width: 100%;\n  accent-color: currentColor;\n}\n\n.bg-studio-note {\n  font-size: 12px;\n  opacity: 0.7;\n  border-radius: 8px;\n  padding: 8px 10px;\n  background: color-mix(in srgb, currentColor 6%, transparent);\n}\n\n/* Image library */\n.bg-studio-library {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));\n  gap: 10px;\n}\n\n.bg-studio-thumb {\n  position: relative;\n  border-radius: 10px;\n  overflow: hidden;\n  border: 2px solid transparent;\n  aspect-ratio: 16 / 10;\n  background-size: cover;\n  background-position: center;\n  cursor: pointer;\n}\n\n.bg-studio-thumb[data-selected='true'] {\n  border-color: color-mix(in srgb, currentColor 70%, transparent);\n}\n\n.bg-studio-thumb .bg-studio-thumb-tag {\n  position: absolute;\n  left: 6px;\n  bottom: 6px;\n  font-size: 10.5px;\n  padding: 1px 6px;\n  border-radius: 999px;\n  background: rgba(0, 0, 0, 0.55);\n  color: #fff;\n}\n\n.bg-studio-thumb .bg-studio-thumb-del {\n  position: absolute;\n  top: 4px;\n  right: 4px;\n  width: 20px;\n  height: 20px;\n  border-radius: 999px;\n  border: none;\n  background: rgba(0, 0, 0, 0.55);\n  color: #fff;\n  cursor: pointer;\n  font-size: 11px;\n  line-height: 1;\n  display: grid;\n  place-items: center;\n}\n\n.bg-studio-thumb .bg-studio-thumb-del:hover {\n  background: rgba(200, 40, 40, 0.85);\n}\n\n/* Actions */\n.bg-studio-actions {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 10px;\n}\n\n.bg-studio-button {\n  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);\n  background: transparent;\n  color: inherit;\n  border-radius: 8px;\n  padding: 6px 14px;\n  cursor: pointer;\n  font: inherit;\n  font-size: 12.5px;\n}\n\n.bg-studio-button:hover {\n  background: color-mix(in srgb, currentColor 8%, transparent);\n}\n\n.bg-studio-status {\n  font-size: 11.5px;\n  opacity: 0.65;\n}\n\nselect.bg-studio-select,\ninput[type='color'].bg-studio-color,\ninput[type='text'].bg-studio-path {\n  font: inherit;\n  font-size: 12.5px;\n  color: inherit;\n  background: transparent;\n  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);\n  border-radius: 6px;\n  padding: 4px 6px;\n}\n\n/* Native <select> dropdown popups ignore inherited dark theming unless the\n   control declares its own color-scheme; without this the popup renders\n   white-on-white in dark mode (options only visible on hover). */\n.bg-studio-select {\n  color-scheme: light;\n}\n\nbody[data-ds-dark-theme] .bg-studio-select {\n  color-scheme: dark;\n}\n\n.bg-studio-select option {\n  background: #f9fafb;\n  color: #0f1115;\n}\n\nbody[data-ds-dark-theme] .bg-studio-select option {\n  background: #151517;\n  color: #f9fafb;\n}\n\n.bg-studio-path {\n  flex: 1;\n  min-width: 200px;\n}\n\n/* Wallpaper bundle cards */\n.bg-studio-wp {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  border: 1px solid color-mix(in srgb, currentColor 16%, transparent);\n  border-radius: 8px;\n  padding: 7px 10px;\n  cursor: pointer;\n}\n\n.bg-studio-wp[data-selected='true'] {\n  border-color: color-mix(in srgb, currentColor 65%, transparent);\n  background: color-mix(in srgb, currentColor 8%, transparent);\n}\n\n.bg-studio-wp-type {\n  font-size: 10px;\n  text-transform: uppercase;\n  letter-spacing: 0.06em;\n  padding: 1px 6px;\n  border-radius: 999px;\n  background: color-mix(in srgb, currentColor 14%, transparent);\n  opacity: 0.85;\n}\n\n.bg-studio-wp-name {\n  flex: 1;\n  font-size: 12.5px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.bg-studio-library .bg-studio-wp {\n  margin-bottom: 0;\n}\n\n.bg-studio-library {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n\n/* Two independent opacity switches side by side. */\n.bg-studio-switchrow {\n  display: flex;\n  gap: 18px;\n  flex-wrap: wrap;\n}\n\n/* Per-wallpaper settings (expanded under the card). */\n.bg-studio-bsettings {\n  margin: 4px 0 8px;\n  padding: 10px 12px;\n  border: 1px dashed color-mix(in srgb, currentColor 22%, transparent);\n  border-radius: 8px;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.bg-studio-wp-gear {\n  border: none;\n  background: transparent;\n  color: inherit;\n  cursor: pointer;\n  font-size: 13px;\n  line-height: 1;\n  padding: 2px 4px;\n  border-radius: 6px;\n  opacity: 0.7;\n}\n\n.bg-studio-wp-gear:hover {\n  opacity: 1;\n  background: color-mix(in srgb, currentColor 10%, transparent);\n}\n\n/* Wallpaper Engine import list */\n.bg-studio-welist {\n  max-height: 260px;\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.bg-studio-weitem {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 5px 8px;\n  border-radius: 8px;\n}\n\n.bg-studio-weitem[data-ok='false'] {\n  opacity: 0.45;\n}\n\n.bg-studio-weitem[data-ok='true']:hover {\n  background: color-mix(in srgb, currentColor 7%, transparent);\n}\n";

// src/client/panel/PanelPage.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var tt = (key) => navigator.language?.toLowerCase().startsWith("zh") ? zh[key] : en[key];
var styleInjected = false;
function ensurePanelStyle() {
  if (styleInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.id = "dsh-bg-studio-panel-style";
  style.textContent = panel_default;
  document.head.append(style);
  styleInjected = true;
}
function panelBaseStyle(opaque, dark) {
  if (!opaque) return { background: "transparent" };
  return { background: dark ? "#151517" : "#f9fafb" };
}
function useDarkScheme() {
  const [dark, setDark] = (0, import_react.useState)(isDarkScheme);
  (0, import_react.useEffect)(() => subscribeColorScheme(() => setDark(isDarkScheme())), []);
  return dark;
}
function Field({ label, value, min, max, step, onChange, format }) {
  const id = (0, import_react.useId)();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-field", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: id, children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "input",
      {
        id,
        type: "range",
        min,
        max,
        step,
        value,
        onChange: (event) => onChange(Number(event.target.value))
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bg-studio-value", children: format ? format(value) : String(Math.round(value * 100) / 100) })
  ] });
}
var MODES = [
  { kind: "none", nameKey: "mode.none", hintKey: "mode.none.hint" },
  { kind: "image", nameKey: "mode.image", hintKey: "mode.image.hint" },
  { kind: "transparent", nameKey: "mode.transparent", hintKey: "mode.transparent.hint" },
  { kind: "frosted", nameKey: "mode.frosted", hintKey: "mode.frosted.hint" },
  { kind: "animated", nameKey: "mode.animated", hintKey: "mode.animated.hint" }
];
function PanelPage({ runtime }) {
  ensurePanelStyle();
  const subscribe = (0, import_react.useCallback)((listener) => runtime.subscribe(listener), [runtime]);
  const snapshot = (0, import_react.useCallback)(() => `${runtime.library.length}:${runtime.wallpaperLibrary.length}:${runtime.materialSupport}:${JSON.stringify(runtime.current)}`, [runtime]);
  (0, import_react.useSyncExternalStore)(subscribe, snapshot);
  const dark = useDarkScheme();
  const settings = runtime.current;
  const fileRef = (0, import_react.useRef)(null);
  const weRootRef = (0, import_react.useRef)("D:\\steam\\steamapps\\workshop\\content\\431960");
  const [expandedId, setExpandedId] = (0, import_react.useState)(null);
  const [weItems, setWeItems] = (0, import_react.useState)(null);
  const [weBusy, setWeBusy] = (0, import_react.useState)(false);
  const weRoot = weRootRef.current;
  if (!settings) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bg-studio-view", "data-dsh-plugin": "bg-studio", style: panelBaseStyle(true, dark), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bg-studio-inner", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: tt("panel.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: tt("action.offline") })
    ] }) }) });
  }
  const onUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await runtime.addImage(file);
  };
  const pickImage = (id) => {
    if (settings.kind === "frosted") runtime.update({ frosted: { ...settings.frosted, imageId: id } });
    else runtime.update({ image: { ...settings.image, imageId: id } });
  };
  const removeLibraryImage = (id) => {
    if (window.confirm(`${tt("library.delete")}?`)) void runtime.removeImage(id);
  };
  const imageSelId = settings.kind === "frosted" ? settings.frosted.imageId : settings.image.imageId;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bg-studio-view", "data-dsh-plugin": "bg-studio", style: panelBaseStyle(settings.panelOpaque !== false, dark), children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-inner", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: tt("panel.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: tt("panel.subtitle") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bg-studio-modes", children: MODES.map((mode) => {
      const active = settings.kind === mode.kind;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "button",
        {
          type: "button",
          className: "bg-studio-mode",
          "data-active": active,
          onClick: () => runtime.update({ kind: mode.kind }),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bg-studio-mode-name", children: tt(mode.nameKey) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bg-studio-mode-hint", children: tt(mode.hintKey) })
          ]
        },
        mode.kind
      );
    }) }),
    settings.kind === "image" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        Field,
        {
          label: tt("image.opacity"),
          value: settings.image.opacity,
          min: 0,
          max: 1,
          step: 0.05,
          onChange: (v) => runtime.update({ image: { ...settings.image, opacity: v } })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        Field,
        {
          label: tt("image.blur"),
          value: settings.image.blur,
          min: 0,
          max: 40,
          step: 1,
          onChange: (v) => runtime.update({ image: { ...settings.image, blur: v } }),
          format: (v) => `${v}px`
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        Field,
        {
          label: tt("image.dim"),
          value: settings.image.dim,
          min: 0,
          max: 0.8,
          step: 0.05,
          onChange: (v) => runtime.update({ image: { ...settings.image, dim: v } })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: tt("image.fit") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "select",
          {
            className: "bg-studio-select",
            value: settings.image.fit,
            onChange: (event) => runtime.update({ image: { ...settings.image, fit: event.target.value } }),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "cover", children: tt("image.fit.cover") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "contain", children: tt("image.fit.contain") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "tile", children: tt("image.fit.tile") })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
          tt("image.tint"),
          settings.image.tint ? `\uFF08${tt("image.tint.custom")}\uFF09` : `\uFF08${tt("image.tint.auto")}\uFF09`
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "color",
            className: "bg-studio-color",
            value: settings.image.tint ?? "#000000",
            onChange: (event) => runtime.update({ image: { ...settings.image, tint: event.target.value } })
          }
        ),
        settings.image.tint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            className: "bg-studio-button bg-studio-tint-clear",
            title: tt("image.tint.auto"),
            onClick: () => runtime.update({ image: { ...settings.image, tint: null } }),
            children: "\xD7"
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
      ] })
    ] }),
    settings.kind === "transparent" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        Field,
        {
          label: tt("transparent.surfaceOpacity"),
          value: settings.transparent.surfaceOpacity,
          min: 0,
          max: 1,
          step: 0.05,
          onChange: (v) => runtime.update({ transparent: { ...settings.transparent, surfaceOpacity: v } })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        Field,
        {
          label: tt("transparent.scrim"),
          value: settings.transparent.scrim,
          min: 0,
          max: 0.5,
          step: 0.02,
          onChange: (v) => runtime.update({ transparent: { ...settings.transparent, scrim: v } })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "bg-studio-note", children: tt("transparent.note") }),
      runtime.materialSupport !== "unknown" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "bg-studio-note", children: tt(runtime.materialSupport === "ok" ? "transparent.material.ok" : "transparent.material.unavailable") })
    ] }),
    settings.kind === "frosted" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        Field,
        {
          label: tt("frosted.blur"),
          value: settings.frosted.blur,
          min: 4,
          max: 48,
          step: 1,
          onChange: (v) => runtime.update({ frosted: { ...settings.frosted, blur: v } }),
          format: (v) => `${v}px`
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        Field,
        {
          label: tt("frosted.surfaceOpacity"),
          value: settings.frosted.surfaceOpacity,
          min: 0.15,
          max: 0.9,
          step: 0.05,
          onChange: (v) => runtime.update({ frosted: { ...settings.frosted, surfaceOpacity: v } })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        Field,
        {
          label: tt("frosted.saturation"),
          value: settings.frosted.saturation,
          min: 1,
          max: 1.8,
          step: 0.05,
          onChange: (v) => runtime.update({ frosted: { ...settings.frosted, saturation: v } }),
          format: (v) => `\xD7${v}`
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: tt("frosted.image") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "select",
          {
            className: "bg-studio-select",
            value: settings.frosted.imageId ?? "",
            onChange: (event) => runtime.update({ frosted: { ...settings.frosted, imageId: event.target.value || null } }),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "", children: tt("frosted.image.auto") }),
              runtime.library.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: entry.id, children: entry.name }, entry.id))
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
      ] })
    ] }),
    settings.kind === "animated" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: tt("wallpaper.library") }),
      runtime.wallpaperLibrary.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "bg-studio-note", children: tt("wallpaper.empty") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bg-studio-library", children: runtime.wallpaperLibrary.map((wp) => {
        const bs = settings.animated.perBundle[wp.id];
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              className: "bg-studio-wp",
              "data-selected": settings.animated.mediaSource === wp.id,
              onClick: () => runtime.update({ animated: { ...settings.animated, mediaSource: wp.id } }),
              onDoubleClick: () => setExpandedId(expandedId === wp.id ? null : wp.id),
              role: "button",
              tabIndex: 0,
              onKeyDown: (event) => {
                if (event.key === "Enter") runtime.update({ animated: { ...settings.animated, mediaSource: wp.id } });
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bg-studio-wp-type", children: wp.type }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bg-studio-wp-name", children: wp.error ? `${wp.name}\uFF08${tt("wallpaper.bad")}\uFF09` : wp.name }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "bg-studio-wp-gear",
                    title: tt("wallpaper.settings"),
                    onClick: (event) => {
                      event.stopPropagation();
                      setExpandedId(expandedId === wp.id ? null : wp.id);
                    },
                    children: "\u2699"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "bg-studio-thumb-del",
                    title: tt("library.delete"),
                    onClick: (event) => {
                      event.stopPropagation();
                      if (window.confirm(`${tt("library.delete")} ${wp.name}?`)) void runtime.removeWallpaper(wp.id);
                    },
                    children: "\xD7"
                  }
                )
              ]
            }
          ),
          expandedId === wp.id && !wp.error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-bsettings", children: [
            wp.type === "video" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                Field,
                {
                  label: tt("wp.volume"),
                  value: bs?.volume ?? 0,
                  min: 0,
                  max: 1,
                  step: 0.05,
                  onChange: (v) => runtime.updateBundleSettings(wp.id, { volume: v })
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                Field,
                {
                  label: tt("wp.rate"),
                  value: bs?.rate ?? 1,
                  min: 0.25,
                  max: 4,
                  step: 0.05,
                  onChange: (v) => runtime.updateBundleSettings(wp.id, { rate: v }),
                  format: (v) => `\xD7${v}`
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-field", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: tt("wp.fit") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "select",
                  {
                    className: "bg-studio-select",
                    value: bs?.fit ?? "cover",
                    onChange: (event) => runtime.updateBundleSettings(wp.id, { fit: event.target.value }),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "cover", children: tt("image.fit.cover") }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "contain", children: tt("image.fit.contain") }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "fill", children: tt("wp.fit.fill") })
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
              ] })
            ] }),
            wp.type === "character" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                Field,
                {
                  label: tt("wallpaper.threshold"),
                  value: bs?.taskThreshold ?? 3,
                  min: 1,
                  max: 16,
                  step: 1,
                  onChange: (v) => runtime.updateBundleSettings(wp.id, { taskThreshold: Math.round(v) }),
                  format: (v) => String(Math.round(v))
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                Field,
                {
                  label: tt("wallpaper.rotate"),
                  value: bs?.idleRotateSec ?? 120,
                  min: 10,
                  max: 600,
                  step: 10,
                  onChange: (v) => runtime.updateBundleSettings(wp.id, { idleRotateSec: Math.round(v) }),
                  format: (v) => `${Math.round(v)}s`
                }
              )
            ] }),
            (wp.type === "web" || wp.type === "canvas") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "bg-studio-note", children: tt("wp.noSettings") })
          ] })
        ] }, wp.id);
      }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "bg-studio-check", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "checkbox",
            checked: settings.animated.respectReducedMotion,
            onChange: (event) => runtime.update({ animated: { ...settings.animated, respectReducedMotion: event.target.checked } })
          }
        ),
        tt("wallpaper.reducedMotion")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "bg-studio-note", children: tt("wallpaper.note") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: tt("we.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "text",
            className: "bg-studio-path",
            defaultValue: weRoot,
            placeholder: tt("we.rootPlaceholder"),
            onChange: (event) => {
              weRootRef.current = event.target.value;
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            className: "bg-studio-button",
            disabled: weBusy,
            onClick: () => {
              void (async () => {
                setWeBusy(true);
                try {
                  setWeItems(await runtime.scanWorkshop(weRootRef.current));
                } catch {
                  setWeItems([]);
                } finally {
                  setWeBusy(false);
                }
              })();
            },
            children: tt("we.scan")
          }
        )
      ] }),
      weItems !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-welist", children: [
        weItems.filter((item) => item.convertible).length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "bg-studio-note", children: tt("we.none") }),
        weItems.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-weitem", "data-ok": item.convertible, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bg-studio-wp-type", children: item.type }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "bg-studio-wp-name", title: item.reason ?? "", children: [
            item.title,
            item.convertible ? "" : ` \u2014 ${item.reason ?? ""}`
          ] }),
          item.convertible && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: "bg-studio-button",
              disabled: weBusy,
              onClick: () => {
                void (async () => {
                  setWeBusy(true);
                  try {
                    await runtime.importFromWorkshop(weRootRef.current, item.id);
                  } finally {
                    setWeBusy(false);
                  }
                })();
              },
              children: tt("we.importOne")
            }
          )
        ] }, item.id))
      ] })
    ] }),
    (settings.kind === "image" || settings.kind === "frosted") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-section", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: tt("section.library") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { ref: fileRef, type: "file", accept: "image/*", hidden: true, onChange: (event) => {
        void onUpload(event);
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "bg-studio-button", onClick: () => fileRef.current?.click(), children: tt("library.add") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bg-studio-status", children: tt("action.saved") })
      ] }),
      runtime.library.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "bg-studio-note", children: tt("library.empty") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bg-studio-library", children: runtime.library.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          className: "bg-studio-thumb",
          "data-selected": imageSelId === entry.id,
          style: { backgroundImage: `url("${imageUrl(entry.id)}")` },
          onClick: () => pickImage(entry.id),
          role: "button",
          tabIndex: 0,
          onKeyDown: (event) => {
            if (event.key === "Enter") pickImage(entry.id);
          },
          children: [
            imageSelId === entry.id && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "bg-studio-thumb-tag", children: tt("library.used") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                className: "bg-studio-thumb-del",
                title: tt("library.delete"),
                onClick: (event) => {
                  event.stopPropagation();
                  removeLibraryImage(entry.id);
                },
                children: "\xD7"
              }
            )
          ]
        },
        entry.id
      )) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-switchrow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "bg-studio-check", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              type: "checkbox",
              checked: settings.panelOpaque !== false,
              onChange: (event) => runtime.update({ panelOpaque: event.target.checked })
            }
          ),
          tt("panel.opaque")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "bg-studio-check", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              type: "checkbox",
              checked: settings.systemDialogsOpaque !== false,
              onChange: (event) => runtime.update({ systemDialogsOpaque: event.target.checked })
            }
          ),
          tt("panel.sysOpaque")
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "bg-studio-button", disabled: settings.kind === "none", onClick: () => runtime.resetMode(), children: tt("action.reset") })
    ] })
  ] }) });
}

// src/client/ids.ts
var BG_STUDIO_PANEL_ID = "bg-studio";

// src/client/panel/PanelIcon.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function PanelIcon({ size }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "svg",
    {
      "data-dsh-panel-entry": BG_STUDIO_PANEL_ID,
      viewBox: "0 0 16 16",
      width: size,
      height: size,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.3",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "2", y: "2.5", width: "12", height: "11", rx: "1.5" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "5.6", cy: "6", r: "1" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M2.5 11l3-3 2.4 2.4L10 8l3.5 3.5" })
      ]
    }
  );
}

// src/client/index.ts
var PANEL_ORDER = 40;
var inject = ["slots", "layout"];
function apply(ctx) {
  const runtime = new BgStudioRuntime();
  void runtime.start();
  const disposers = [];
  try {
    const slots = ctx.slots;
    disposers.push(slots.inject("sidebar.panellist", () => slots.register({
      name: "sidebar.panellist",
      id: BG_STUDIO_PANEL_ID,
      order: PANEL_ORDER,
      label: () => navigator.language?.toLowerCase().startsWith("zh") ? "\u80CC\u666F" : "Background"
    }, PanelIcon)));
    disposers.push(slots.inject("main", () => slots.register({
      name: "main",
      key: BG_STUDIO_PANEL_ID,
      inject: () => ({ runtime })
    }, PanelPage)));
  } catch (error) {
    console.warn("[bg-studio] panel registration failed:", error);
  }
  ctx.effect(() => () => {
    for (const dispose of disposers.splice(0)) dispose();
    runtime.dispose();
  }, "bg-studio: runtime");
}
;return module.exports;}});
//# sourceMappingURL=client.js.map
