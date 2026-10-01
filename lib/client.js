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

// src/client/background.ts
var PROVIDERS = {
  image: imageProvider,
  transparent: transparentProvider,
  frosted: frostedProvider
  // 'animated' registers here when the wallpaper provider ships.
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
}

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

// src/client/runtime.ts
var PERSIST_DEBOUNCE_MS = 350;
var BgStudioRuntime = class {
  settings = null;
  images = [];
  layer = new BackgroundLayer();
  saveTimer = null;
  offScheme = null;
  /** DWM material verdict: 'unknown' until first try, then 'ok'/'unavailable'. */
  materialSupport = "unknown";
  materialNow = null;
  providerCtx = {
    imageUrl,
    isDark: isDarkScheme,
    onSchemeChange: subscribeColorScheme
  };
  /** Panels re-render on state changes (settings swaps, library edits). */
  listeners = /* @__PURE__ */ new Set();
  get current() {
    return this.settings;
  }
  get library() {
    return this.images;
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
    this.emit();
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
  "mode.transparent.hint": "Surfaces go see-through.",
  "mode.frosted": "Frosted glass",
  "mode.frosted.hint": "Blurred glass surfaces.",
  "mode.animated": "Animated",
  "mode.animated.hint": "Dynamic wallpapers \u2014 planned, not in this version.",
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
  "image.tint.auto": "Auto (black)",
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
  "action.reset": "Restore defaults",
  "action.offline": "Plugin host unreachable \u2014 changes cannot be saved.",
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
  "mode.transparent.hint": "\u5185\u5BB9\u8868\u9762\u53D8\u4E3A\u5168\u900F\u660E\u3002",
  "mode.frosted": "\u6BDB\u73BB\u7483",
  "mode.frosted.hint": "\u8868\u9762\u5448\u78E8\u7802\u73BB\u7483\u8D28\u611F\u3002",
  "mode.animated": "\u52A8\u6001",
  "mode.animated.hint": "\u52A8\u6001\u58C1\u7EB8\u2014\u2014\u5DF2\u9884\u7559\uFF0C\u672C\u7248\u672C\u6682\u672A\u5F00\u653E\u3002",
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
  "image.tint.auto": "\u81EA\u52A8\uFF08\u9ED1\u8272\uFF09",
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
  "action.reset": "\u6062\u590D\u9ED8\u8BA4",
  "action.offline": "\u63D2\u4EF6\u540E\u53F0\u670D\u52A1\u4E0D\u53EF\u8FBE\u2014\u2014\u6682\u65F6\u65E0\u6CD5\u4FDD\u5B58\u66F4\u6539\u3002",
  "action.saved": "\u66F4\u6539\u5373\u65F6\u751F\u6548\u5E76\u81EA\u52A8\u4FDD\u5B58\u3002"
};

// src/client/panel/panel.css
var panel_default = "/* Background Studio panel. All classes prefixed bg-studio- (plain CSS,\n   injected as a style element \u2014 no CSS-module machinery, no build magic). */\n\n/* The view shell paints an OPAQUE, theme-matched base: while transparent /\n   frosted modes clear the app surfaces, the settings panel itself must stay\n   readable \u2014 you tune the effect here while it applies everywhere else. */\n.bg-studio-view {\n  min-height: 100%;\n  padding: 20px 0 48px;\n  background: #f9fafb;\n}\n\nbody[data-ds-dark-theme] .bg-studio-view {\n  background: #151517;\n}\n\n.bg-studio-inner {\n  max-width: 720px;\n  margin: 0 auto;\n  padding: 0 22px;\n  display: flex;\n  flex-direction: column;\n  gap: 18px;\n  font-size: 13px;\n  line-height: 1.55;\n}\n\n.bg-studio-header h2 {\n  margin: 0 0 4px;\n  font-size: 17px;\n}\n\n.bg-studio-header p {\n  margin: 0;\n  opacity: 0.75;\n  font-size: 12.5px;\n}\n\n/* Mode cards */\n.bg-studio-modes {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));\n  gap: 10px;\n}\n\n.bg-studio-mode {\n  text-align: left;\n  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);\n  border-radius: 10px;\n  padding: 10px 12px;\n  background: transparent;\n  cursor: pointer;\n  font: inherit;\n  color: inherit;\n  display: flex;\n  flex-direction: column;\n  gap: 3px;\n  transition: border-color 0.15s ease, background 0.15s ease;\n}\n\n.bg-studio-mode:hover {\n  border-color: color-mix(in srgb, currentColor 40%, transparent);\n}\n\n.bg-studio-mode[data-active='true'] {\n  border-color: color-mix(in srgb, currentColor 65%, transparent);\n  background: color-mix(in srgb, currentColor 8%, transparent);\n}\n\n.bg-studio-mode[data-disabled='true'] {\n  opacity: 0.45;\n  cursor: default;\n}\n\n.bg-studio-mode .bg-studio-mode-name {\n  font-weight: 600;\n}\n\n.bg-studio-mode .bg-studio-mode-hint {\n  font-size: 11.5px;\n  opacity: 0.7;\n}\n\n/* Sections and controls */\n.bg-studio-section {\n  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);\n  border-radius: 12px;\n  padding: 14px 16px;\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n\n.bg-studio-section h3 {\n  margin: 0;\n  font-size: 13px;\n  font-weight: 600;\n}\n\n.bg-studio-field {\n  display: grid;\n  grid-template-columns: 150px 1fr 52px;\n  align-items: center;\n  gap: 10px;\n}\n\n.bg-studio-field label {\n  font-size: 12.5px;\n}\n\n.bg-studio-field .bg-studio-value {\n  text-align: right;\n  font-variant-numeric: tabular-nums;\n  font-size: 12px;\n  opacity: 0.8;\n}\n\n.bg-studio-field input[type='range'] {\n  width: 100%;\n  accent-color: currentColor;\n}\n\n.bg-studio-note {\n  font-size: 12px;\n  opacity: 0.7;\n  border-radius: 8px;\n  padding: 8px 10px;\n  background: color-mix(in srgb, currentColor 6%, transparent);\n}\n\n/* Image library */\n.bg-studio-library {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));\n  gap: 10px;\n}\n\n.bg-studio-thumb {\n  position: relative;\n  border-radius: 10px;\n  overflow: hidden;\n  border: 2px solid transparent;\n  aspect-ratio: 16 / 10;\n  background-size: cover;\n  background-position: center;\n  cursor: pointer;\n}\n\n.bg-studio-thumb[data-selected='true'] {\n  border-color: color-mix(in srgb, currentColor 70%, transparent);\n}\n\n.bg-studio-thumb .bg-studio-thumb-tag {\n  position: absolute;\n  left: 6px;\n  bottom: 6px;\n  font-size: 10.5px;\n  padding: 1px 6px;\n  border-radius: 999px;\n  background: rgba(0, 0, 0, 0.55);\n  color: #fff;\n}\n\n.bg-studio-thumb .bg-studio-thumb-del {\n  position: absolute;\n  top: 4px;\n  right: 4px;\n  width: 20px;\n  height: 20px;\n  border-radius: 999px;\n  border: none;\n  background: rgba(0, 0, 0, 0.55);\n  color: #fff;\n  cursor: pointer;\n  font-size: 11px;\n  line-height: 1;\n  display: grid;\n  place-items: center;\n}\n\n.bg-studio-thumb .bg-studio-thumb-del:hover {\n  background: rgba(200, 40, 40, 0.85);\n}\n\n/* Actions */\n.bg-studio-actions {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 10px;\n}\n\n.bg-studio-button {\n  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);\n  background: transparent;\n  color: inherit;\n  border-radius: 8px;\n  padding: 6px 14px;\n  cursor: pointer;\n  font: inherit;\n  font-size: 12.5px;\n}\n\n.bg-studio-button:hover {\n  background: color-mix(in srgb, currentColor 8%, transparent);\n}\n\n.bg-studio-status {\n  font-size: 11.5px;\n  opacity: 0.65;\n}\n\nselect.bg-studio-select,\ninput[type='color'].bg-studio-color {\n  font: inherit;\n  font-size: 12.5px;\n  color: inherit;\n  background: transparent;\n  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);\n  border-radius: 6px;\n  padding: 4px 6px;\n}\n";

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
  const snapshot = (0, import_react.useCallback)(() => `${runtime.library.length}:${runtime.materialSupport}:${JSON.stringify(runtime.current)}`, [runtime]);
  (0, import_react.useSyncExternalStore)(subscribe, snapshot);
  const settings = runtime.current;
  const fileRef = (0, import_react.useRef)(null);
  if (!settings) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bg-studio-view", "data-dsh-plugin": "bg-studio", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bg-studio-inner", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-header", children: [
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bg-studio-view", "data-dsh-plugin": "bg-studio", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-inner", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: tt("panel.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: tt("panel.subtitle") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bg-studio-modes", children: MODES.map((mode) => {
      const disabled = mode.kind === "animated";
      const active = !disabled && settings.kind === mode.kind;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "button",
        {
          type: "button",
          className: "bg-studio-mode",
          "data-active": active,
          "data-disabled": disabled,
          onClick: () => {
            if (!disabled) runtime.update({ kind: mode.kind });
          },
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
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: tt("image.tint") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "color",
            className: "bg-studio-color",
            value: settings.image.tint ?? "#000000",
            onChange: (event) => runtime.update({ image: { ...settings.image, tint: event.target.value } })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "bg-studio-button", onClick: () => runtime.update({ image: { ...settings.image, tint: null } }), children: tt("image.tint.auto") })
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
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "bg-studio-section", children: [
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
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bg-studio-actions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "bg-studio-button", onClick: () => {
      void runtime.reset();
    }, children: tt("action.reset") }) })
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
