// src/host/index.ts
import { homedir } from "node:os";
import { createRequire } from "node:module";
import { join as join2, sep } from "node:path";
import Schema from "@deepseek-ai/schemastery";

// src/host/store.ts
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile, cp, rm } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join, normalize, extname } from "node:path";

// src/shared/protocol.ts
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
    idleRotateSec: clamp(Number(src.idleRotateSec ?? 120), 5, 3600)
  };
}
function sanitizePerBundle(raw, legacyThreshold, legacyRotate) {
  const out = {};
  const src = raw && typeof raw === "object" ? raw : {};
  for (const [id, value] of Object.entries(src)) {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) continue;
    out[id] = sanitizeBundleSettings(value);
  }
  if (legacyThreshold !== void 0 || legacyRotate !== void 0) {
    const th = clamp(Number(legacyThreshold ?? 3), 1, 16);
    const rot = clamp(Number(legacyRotate ?? 120), 5, 3600);
    for (const id of Object.keys(out)) {
      out[id] = { ...out[id], taskThreshold: th, idleRotateSec: rot };
    }
  }
  return out;
}
function sanitizeSettings(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const img = src.image && typeof src.image === "object" ? src.image : {};
  const tra = src.transparent && typeof src.transparent === "object" ? src.transparent : {};
  const fro = src.frosted && typeof src.frosted === "object" ? src.frosted : {};
  const ani = src.animated && typeof src.animated === "object" ? src.animated : {};
  const kind = ["none", "image", "transparent", "frosted", "animated"].includes(src.kind) ? src.kind : "none";
  return {
    kind,
    image: {
      imageId: typeof img.imageId === "string" ? img.imageId : null,
      fit: ["cover", "contain", "tile"].includes(img.fit) ? img.fit : "cover",
      opacity: clamp(Number(img.opacity ?? 1), 0, 1),
      blur: clamp(Number(img.blur ?? 0), 0, 40),
      dim: clamp(Number(img.dim ?? 0.25), 0, 0.8),
      tint: typeof img.tint === "string" && /^#[0-9a-fA-F]{3,8}$/.test(img.tint) ? img.tint : null
    },
    transparent: {
      surfaceOpacity: clamp(Number(tra.surfaceOpacity ?? 0), 0, 1),
      scrim: clamp(Number(tra.scrim ?? 0.08), 0, 0.5)
    },
    frosted: {
      blur: clamp(Number(fro.blur ?? 18), 4, 48),
      surfaceOpacity: clamp(Number(fro.surfaceOpacity ?? 0.55), 0.15, 0.9),
      saturation: clamp(Number(fro.saturation ?? 1.25), 1, 1.8),
      imageId: typeof fro.imageId === "string" ? fro.imageId : null
    },
    animated: {
      mediaSource: typeof ani.mediaSource === "string" && ani.mediaSource !== "" ? ani.mediaSource : null,
      respectReducedMotion: ani.respectReducedMotion !== false,
      // Per-bundle map, each entry sanitized; legacy global threshold/rotate
      // values migrate into each existing bundle's settings once.
      perBundle: sanitizePerBundle(ani.perBundle, ani.taskThreshold, ani.idleRotateSec)
    },
    panelOpaque: src.panelOpaque !== false,
    systemDialogsOpaque: src.systemDialogsOpaque !== false
  };
}
function applySettingsPatch(current, patch) {
  const p = patch && typeof patch === "object" ? patch : {};
  return sanitizeSettings({ ...current, ...p });
}
var IMAGE_MIME_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/avif": "avif"
};
var WALLPAPER_FORMAT = "dsh-wallpaper/1";

// src/host/store.ts
var ASSET_MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};
var WE_SHIM = [
  "<script>",
  "(function(){var n=function(){};",
  "window.wallpaperRegister=n;window.wallpaperRegisterAudioListener=n;",
  "window.wallpaperRequestRandomFileForProperty=n;window.wallpaperRequestFileForProperty=n;",
  "window.wallpaperPropertyListener=null;",
  'window.addEventListener("message",function(ev){var d=ev.data||{};',
  'if(d.source==="dsh-bg-studio"&&typeof window.wallpaperPropertyListener==="function")',
  'window.wallpaperPropertyListener({name:"dshActivity",value:d});});',
  "})();</script>",
  "<style>html{background:transparent}</style>"
].join("");
function rewriteHtmlForServing(bundleId, html) {
  const toAbsolute = (raw) => {
    if (raw === "" || /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|\/|#|data:)/.test(raw)) return raw;
    const cleaned = raw.split("#")[0].split("?")[0];
    if (cleaned === "") return raw;
    return `/api/dsh-bg-studio/asset?id=${encodeURIComponent(bundleId)}&path=${encodeURIComponent(cleaned)}`;
  };
  let out = html.replace(/(\s(?:src|href)\s*=\s*)(["'])([^"']*)\2/gi, (m, attr, q, url) => `${attr}${q}${toAbsolute(url)}${q}`);
  out = out.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, url) => `url(${q}${toAbsolute(url)}${q})`);
  const injection = WE_SHIM;
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, (m) => `${m}${injection}`);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, (m) => `${m}${injection}`);
  } else {
    out = injection + out;
  }
  return out;
}
var BgStudioStore = class {
  constructor(dataDir) {
    this.dataDir = dataDir;
  }
  get settingsPath() {
    return join(this.dataDir, "settings.json");
  }
  get imagesDir() {
    return join(this.dataDir, "images");
  }
  get wallpapersDir() {
    return join(this.dataDir, "wallpapers");
  }
  async ensureDirs() {
    await mkdir(this.imagesDir, { recursive: true });
  }
  /** Load settings, repairing shape errors; missing file = defaults. */
  async loadSettings() {
    try {
      const text = await readFile(this.settingsPath, "utf8");
      return sanitizeSettings(JSON.parse(text));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
  /** Merge a patch and persist atomically; returns the stored result. */
  async savePatch(patch) {
    const next = applySettingsPatch(await this.loadSettings(), patch);
    const body = JSON.stringify(next, null, 2) + "\n";
    await mkdir(this.dataDir, { recursive: true });
    const tmp = join(this.dataDir, `settings.json.${randomBytes(4).toString("hex")}.tmp`);
    await writeFile(tmp, body, "utf8");
    await rename(tmp, this.settingsPath);
    return next;
  }
  /** Reset to defaults and persist. */
  async reset() {
    const body = JSON.stringify(DEFAULT_SETTINGS, null, 2) + "\n";
    await mkdir(this.dataDir, { recursive: true });
    const tmp = join(this.dataDir, `settings.json.${randomBytes(4).toString("hex")}.tmp`);
    await writeFile(tmp, body, "utf8");
    await rename(tmp, this.settingsPath);
    return { ...DEFAULT_SETTINGS };
  }
  /** List library images with metadata; unreadable entries are skipped. */
  async listImages() {
    let names;
    try {
      names = await readdir(this.imagesDir);
    } catch {
      return [];
    }
    const entries = [];
    for (const name2 of names) {
      const dot = name2.lastIndexOf(".");
      if (dot <= 0) continue;
      const ext = name2.slice(dot + 1).toLowerCase();
      const mime = Object.entries(IMAGE_MIME_EXT).find(([, e]) => e === ext)?.[0];
      if (!mime) continue;
      try {
        const info = await stat(join(this.imagesDir, name2));
        if (!info.isFile()) continue;
        entries.push({
          id: name2.slice(0, dot),
          name: name2,
          bytes: info.size,
          mime,
          addedAt: info.mtimeMs
        });
      } catch {
      }
    }
    entries.sort((a, b) => b.addedAt - a.addedAt);
    return entries;
  }
  /** Read image bytes; null when the id is unknown or unreadable. */
  async readImage(id) {
    if (!/^[a-f0-9]{8,32}$/.test(id)) return null;
    for (const [mime, ext] of Object.entries(IMAGE_MIME_EXT)) {
      try {
        const bytes = await readFile(join(this.imagesDir, `${id}.${ext}`));
        return { bytes, mime };
      } catch {
      }
    }
    return null;
  }
  /** Persist image bytes; returns the new id. */
  async saveImage(bytes, mime) {
    const ext = IMAGE_MIME_EXT[mime];
    if (!ext) throw new Error(`unsupported image type: ${mime}`);
    await this.ensureDirs();
    const id = randomBytes(12).toString("hex");
    await writeFile(join(this.imagesDir, `${id}.${ext}`), bytes);
    return id;
  }
  /** Delete an image; false when it did not exist. */
  async deleteImage(id) {
    if (!/^[a-f0-9]{8,32}$/.test(id)) return false;
    for (const ext of Object.values(IMAGE_MIME_EXT)) {
      try {
        await unlink(join(this.imagesDir, `${id}.${ext}`));
        return true;
      } catch {
      }
    }
    return false;
  }
  /* ------------------------- wallpaper bundles ------------------------- */
  /** Parse one bundle directory into a listing entry (error field carries
   * manifest problems instead of throwing). */
  async readBundle(id) {
    const dir = join(this.wallpapersDir, id);
    let manifest;
    try {
      manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8"));
    } catch {
      return { id, name: id, type: "web", description: "", author: "", entry: "", error: "manifest.json missing or invalid" };
    }
    const problem = manifest.format !== WALLPAPER_FORMAT ? `unsupported format: ${String(manifest.format)}` : !["video", "web", "canvas", "character"].includes(manifest.type) ? `unknown type: ${String(manifest.type)}` : typeof manifest.entry !== "string" || manifest.entry === "" ? "missing entry" : void 0;
    return {
      id,
      name: manifest.name || id,
      type: manifest.type,
      description: manifest.description ?? "",
      author: manifest.author ?? "",
      entry: manifest.entry,
      error: problem
    };
  }
  /** List installed wallpaper bundles (sorted by name). */
  async listWallpapers() {
    let ids;
    try {
      ids = await readdir(this.wallpapersDir);
    } catch {
      return [];
    }
    const entries = [];
    for (const id of ids) {
      try {
        if (!(await stat(join(this.wallpapersDir, id))).isDirectory()) continue;
      } catch {
        continue;
      }
      const entry = await this.readBundle(id);
      if (entry) entries.push(entry);
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return entries;
  }
  /** Read a bundle's manifest; null when unreadable. */
  async readManifest(id) {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) return null;
    try {
      return JSON.parse(await readFile(join(this.wallpapersDir, id, "manifest.json"), "utf8"));
    } catch {
      return null;
    }
  }
  /** Import a bundle from a local directory (recursive copy). Returns the
   * new bundle id. Throws with a readable message on bad input. */
  async importWallpaper(fromDir) {
    const source = normalize(fromDir);
    let probe;
    try {
      probe = await readFile(join(source, "manifest.json"), "utf8");
    } catch {
      throw new Error("no manifest.json under that directory");
    }
    const manifest = JSON.parse(probe);
    if (manifest.format !== WALLPAPER_FORMAT) {
      throw new Error(`unsupported format: ${String(manifest.format)} (expected ${WALLPAPER_FORMAT})`);
    }
    const id = `wp-${randomBytes(6).toString("hex")}`;
    await mkdir(this.wallpapersDir, { recursive: true });
    await cp(source, join(this.wallpapersDir, id), { recursive: true });
    return id;
  }
  /** Delete a bundle; false when it did not exist. */
  async deleteWallpaper(id) {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) return false;
    try {
      await rm(join(this.wallpapersDir, id), { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }
  /** Serve one file from a bundle. Path is validated to stay inside the
   * bundle (no .., no absolute, no drive letters). */
  async readAsset(id, relPath) {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id)) return null;
    if (relPath === "" || relPath.includes("..") || /^[a-zA-Z]:/.test(relPath) || relPath.startsWith("/") || relPath.startsWith("\\")) {
      return null;
    }
    const base = normalize(join(this.wallpapersDir, id));
    const target = normalize(join(base, relPath));
    if (!target.startsWith(base)) return null;
    try {
      const bytes = await readFile(target);
      const mime = ASSET_MIME[extname(target).toLowerCase()] ?? "application/octet-stream";
      if (mime.startsWith("text/html")) {
        const rewritten = rewriteHtmlForServing(id, bytes.toString("utf8"));
        return { bytes: Buffer.from(rewritten, "utf8"), mime };
      }
      return { bytes, mime };
    } catch {
      return null;
    }
  }
  /* --------------------- Wallpaper Engine workshop --------------------- */
  /** Scan a WE workshop content directory; returns one row per wallpaper
   * with a convertibility verdict. Read-only. */
  async scanWorkshop(root) {
    const items = [];
    let entries;
    try {
      entries = await readdir(root);
    } catch {
      return items;
    }
    for (const wid of entries) {
      if (!/^\d+$/.test(wid)) continue;
      try {
        const project = JSON.parse(await readFile(join(root, wid, "project.json"), "utf8"));
        const type = String(project.type ?? "").toLowerCase();
        const file = String(project.file ?? "");
        const title = String(project.title ?? wid);
        const convertible = (type === "video" || type === "web") && file !== "";
        items.push({
          id: wid,
          title,
          type,
          file,
          convertible,
          reason: convertible ? void 0 : type === "video" || type === "web" ? "\u5165\u53E3\u6587\u4EF6\u7F3A\u5931" : "WE \u4E13\u5C5E\u573A\u666F\u683C\u5F0F\uFF0C\u6682\u4E0D\u652F\u6301"
        });
      } catch {
        items.push({ id: wid, title: wid, type: "?", file: "", convertible: false, reason: "project.json \u7F3A\u5931\u6216\u635F\u574F" });
      }
    }
    items.sort((a, b) => a.title.localeCompare(b.title));
    return items;
  }
  /** Convert one WE workshop wallpaper into a library bundle WITHOUT writing
   * anything into the workshop directory: the converted manifest and the
   * needed assets are copied into our storage. Video bundles copy just the
   * movie file; web bundles copy everything except WE metadata/previews.
   * Returns the new bundle id. */
  async importFromWorkshop(root, wid) {
    if (!/^\d+$/.test(wid)) throw new Error("bad workshop id");
    const source = normalize(join(root, wid));
    const project = JSON.parse(await readFile(join(source, "project.json"), "utf8"));
    const type = String(project.type ?? "").toLowerCase();
    const entry = String(project.file ?? "");
    if (!((type === "video" || type === "web") && entry)) {
      throw new Error(`\u8BE5\u58C1\u7EB8\u7C7B\u578B\uFF08${type || "?"}\uFF09\u6682\u4E0D\u652F\u6301\u8F6C\u6362`);
    }
    const id = `wp-${randomBytes(6).toString("hex")}`;
    const dest = join(this.wallpapersDir, id);
    await mkdir(dest, { recursive: true });
    const manifest = {
      format: WALLPAPER_FORMAT,
      name: String(project.title ?? wid),
      description: `Imported from Wallpaper Engine workshop ${wid}`,
      author: String(project.author || "workshop"),
      type,
      entry
    };
    await writeFile(join(dest, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
    if (type === "video") {
      await cp(join(source, entry), join(dest, entry));
    } else {
      for (const name2 of await readdir(source)) {
        if (name2 === "project.json" || /^preview\.(gif|jpg|png|webp)$/i.test(name2)) continue;
        await cp(join(source, name2), join(dest, name2), { recursive: true });
      }
    }
    return id;
  }
};

// src/host/activity.ts
var debugStateOverride = null;
function setDebugState(state) {
  debugStateOverride = state;
}
var ActivityBridge = class {
  /** sessionId → last seen seq (fences duplicates and out-of-order events). */
  seen = /* @__PURE__ */ new Map();
  /** sessions currently inside a turn. */
  active = /* @__PURE__ */ new Set();
  constructor() {
  }
  /** Feed one session event; ignores everything except turn boundaries. */
  accept(sessionId, event) {
    if (typeof sessionId !== "string" || sessionId === "") return;
    const seq = Number(event?.seq);
    if (!Number.isSafeInteger(seq) || seq < 0) return;
    if (seq <= (this.seen.get(sessionId) ?? -1)) return;
    if (event.type === "turn/start") {
      this.seen.set(sessionId, seq);
      this.active.add(sessionId);
    } else if (event.type === "turn/end") {
      this.seen.set(sessionId, seq);
      this.active.delete(sessionId);
    }
    if (this.seen.size > 4096) {
      const oldest = this.seen.keys();
      for (let i = 0; i < 1024; i++) {
        const key = oldest.next();
        if (key.done) break;
        this.seen.delete(key.value);
      }
    }
  }
  /** Current snapshot against a task-count threshold. */
  snapshot(threshold) {
    if (debugStateOverride !== null) {
      const count = debugStateOverride === "idle" ? 0 : debugStateOverride === "busy" ? 1 : threshold + 1;
      return { activeTasks: count, state: debugStateOverride };
    }
    const activeTasks = this.active.size;
    const state = activeTasks === 0 ? "idle" : activeTasks <= threshold ? "busy" : "overloaded";
    return { activeTasks, state };
  }
  dispose() {
    this.seen.clear();
    this.active.clear();
  }
};
function mountActivityBridge(ctx) {
  const bridge = new ActivityBridge();
  ctx.on("session/event", (session, event) => {
    bridge.accept(session?.id, event);
  }, { global: true });
  ctx.effect(() => () => bridge.dispose(), "bg-studio: activity bridge");
  return bridge;
}

// src/host/routes.ts
var ROUTES = {
  settings: "/api/dsh-bg-studio/settings",
  reset: "/api/dsh-bg-studio/reset",
  images: "/api/dsh-bg-studio/images",
  image: "/api/dsh-bg-studio/image",
  windowMaterial: "/api/dsh-bg-studio/window-material",
  wallpapers: "/api/dsh-bg-studio/wallpapers",
  asset: "/api/dsh-bg-studio/asset",
  activity: "/api/dsh-bg-studio/activity",
  weScan: "/api/dsh-bg-studio/we-scan",
  weImport: "/api/dsh-bg-studio/we-import"
};
function writeJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(text),
    "cache-control": "no-store"
  });
  res.end(text);
}
function isIPv4Loopback(v4) {
  const parts = v4.split(".");
  return parts.length === 4 && parts[0] === "127" && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}
function isLoopbackRequest(req) {
  const remote = req.socket.remoteAddress;
  if (remote === void 0) return false;
  const norm = remote.toLowerCase();
  const socketOk = norm === "::1" || norm.startsWith("::ffff:") && isIPv4Loopback(norm.slice(7)) || isIPv4Loopback(norm);
  if (!socketOk) return false;
  try {
    const host = new URL("http://" + (req.headers.host ?? "")).hostname;
    return host === "localhost" || host === "[::1]" || isIPv4Loopback(host);
  } catch {
    return false;
  }
}
function guard(req, res, method) {
  if (req.method !== method) {
    writeJson(res, 405, { error: `method not allowed (${req.method})` });
    return false;
  }
  if (!isLoopbackRequest(req)) {
    writeJson(res, 403, { error: "loopback only" });
    return false;
  }
  return true;
}
function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        req.destroy();
        reject(new Error("body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
async function readJsonObject(req, maxBytes = 256 * 1024) {
  try {
    const raw = await readBody(req, maxBytes);
    if (raw.length === 0) return null;
    const parsed = JSON.parse(raw.toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
function queryParam(req, name2) {
  try {
    const value = new URL(req.url ?? "/", "http://x").searchParams.get(name2);
    return value === null ? void 0 : value;
  } catch {
    return void 0;
  }
}
async function settingsView(store) {
  return { settings: await store.loadSettings(), images: await store.listImages() };
}
function makeRoutes({ store, maxImageBytes, logger, applyWindowMaterial: applyWindowMaterial2, activity }) {
  return [
    {
      kind: "exact",
      path: ROUTES.settings,
      handler: async (req, res) => {
        try {
          if (req.method === "GET") {
            writeJson(res, 200, await settingsView(store));
            return;
          }
          if (req.method === "PUT") {
            const patch = await readJsonObject(req);
            if (patch === null) {
              writeJson(res, 400, { error: "expected a JSON object body" });
              return;
            }
            await store.savePatch(patch);
            writeJson(res, 200, await settingsView(store));
            return;
          }
          writeJson(res, 405, { error: `method not allowed (${req.method})` });
        } catch (error) {
          logger.warn(error);
          writeJson(res, 500, { error: String(error) });
        }
      }
    },
    {
      kind: "exact",
      path: ROUTES.reset,
      handler: async (req, res) => {
        if (!guard(req, res, "POST")) return;
        try {
          await store.reset();
          writeJson(res, 200, await settingsView(store));
        } catch (error) {
          logger.warn(error);
          writeJson(res, 500, { error: String(error) });
        }
      }
    },
    {
      kind: "exact",
      path: ROUTES.images,
      handler: async (req, res) => {
        try {
          if (req.method === "DELETE") {
            const id = queryParam(req, "id");
            if (!id) {
              writeJson(res, 400, { error: "expected ?id=<image id>" });
              return;
            }
            const ok = await store.deleteImage(id);
            writeJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: "unknown image" });
            return;
          }
          if (req.method === "POST") {
            const mime = String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
            if (!IMAGE_MIME_EXT[mime]) {
              writeJson(res, 415, { error: `unsupported image type: ${mime || "(none)"}` });
              return;
            }
            let bytes;
            try {
              bytes = await readBody(req, maxImageBytes);
            } catch {
              writeJson(res, 413, { error: "image too large" });
              return;
            }
            if (bytes.length === 0) {
              writeJson(res, 400, { error: "empty body" });
              return;
            }
            const id = await store.saveImage(bytes, mime);
            writeJson(res, 201, { id });
            return;
          }
          writeJson(res, 405, { error: `method not allowed (${req.method})` });
        } catch (error) {
          logger.warn(error);
          writeJson(res, 500, { error: String(error) });
        }
      }
    },
    {
      kind: "exact",
      path: ROUTES.windowMaterial,
      handler: async (req, res) => {
        try {
          if (req.method === "POST") {
            const body = await readJsonObject(req, 4 * 1024);
            const material = body?.material;
            if (typeof material !== "string" || !["acrylic", "mica", "none"].includes(material)) {
              writeJson(res, 400, { error: "expected {material: 'acrylic'|'mica'|'none'}" });
              return;
            }
            if (!applyWindowMaterial2) {
              writeJson(res, 200, { ok: false, detail: "electron-unavailable" });
              return;
            }
            writeJson(res, 200, applyWindowMaterial2(material));
            return;
          }
          writeJson(res, 405, { error: `method not allowed (${req.method})` });
        } catch (error) {
          logger.warn(error);
          writeJson(res, 500, { error: String(error) });
        }
      }
    },
    {
      kind: "exact",
      path: ROUTES.wallpapers,
      handler: async (req, res) => {
        try {
          if (req.method === "GET") {
            writeJson(res, 200, { wallpapers: await store.listWallpapers() });
            return;
          }
          if (req.method === "POST") {
            const dir = queryParam(req, "dir");
            if (!dir) {
              writeJson(res, 400, { error: "expected ?dir=<absolute bundle directory>" });
              return;
            }
            try {
              const id = await store.importWallpaper(dir);
              writeJson(res, 201, { id });
            } catch (error) {
              writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
            }
            return;
          }
          if (req.method === "DELETE") {
            const id = queryParam(req, "id");
            if (!id) {
              writeJson(res, 400, { error: "expected ?id=<bundle id>" });
              return;
            }
            const ok = await store.deleteWallpaper(id);
            writeJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: "unknown bundle" });
            return;
          }
          writeJson(res, 405, { error: `method not allowed (${req.method})` });
        } catch (error) {
          logger.warn(error);
          writeJson(res, 500, { error: String(error) });
        }
      }
    },
    {
      kind: "exact",
      path: ROUTES.asset,
      handler: async (req, res) => {
        try {
          if (req.method !== "GET") {
            writeJson(res, 405, { error: `method not allowed (${req.method})` });
            return;
          }
          const id = queryParam(req, "id");
          const path = queryParam(req, "path") ?? "";
          if (!id) {
            writeJson(res, 400, { error: "expected ?id=<bundle id>&path=<file>" });
            return;
          }
          const found = await store.readAsset(id, path);
          if (!found) {
            writeJson(res, 404, { error: "asset not found" });
            return;
          }
          res.writeHead(200, {
            "content-type": found.mime,
            "content-length": found.bytes.length,
            // Bundle ids are random and bundles are immutable once imported.
            "cache-control": "public, max-age=86400"
          });
          res.end(found.bytes);
        } catch (error) {
          logger.warn(error);
          writeJson(res, 500, { error: String(error) });
        }
      }
    },
    {
      kind: "exact",
      path: ROUTES.activity,
      handler: async (req, res) => {
        try {
          if (req.method !== "GET") {
            writeJson(res, 405, { error: `method not allowed (${req.method})` });
            return;
          }
          if (!activity) {
            writeJson(res, 200, { activeTasks: 0, state: "idle" });
            return;
          }
          const debug = queryParam(req, "debugState");
          if (debug !== void 0) {
            if (debug === "" || debug === "none") setDebugState(null);
            else if (debug === "idle" || debug === "busy" || debug === "overloaded") setDebugState(debug);
          }
          const threshold = Number(queryParam(req, "threshold") ?? 3);
          writeJson(res, 200, activity.snapshot(Number.isFinite(threshold) ? Math.max(1, threshold) : 3));
        } catch (error) {
          logger.warn(error);
          writeJson(res, 500, { error: String(error) });
        }
      }
    },
    {
      kind: "exact",
      path: ROUTES.weScan,
      handler: async (req, res) => {
        try {
          if (req.method !== "GET") {
            writeJson(res, 405, { error: `method not allowed (${req.method})` });
            return;
          }
          const root = queryParam(req, "root");
          if (!root) {
            writeJson(res, 400, { error: "expected ?root=<workshop content dir>" });
            return;
          }
          writeJson(res, 200, { items: await store.scanWorkshop(root) });
        } catch (error) {
          logger.warn(error);
          writeJson(res, 500, { error: String(error) });
        }
      }
    },
    {
      kind: "exact",
      path: ROUTES.weImport,
      handler: async (req, res) => {
        try {
          if (req.method !== "POST") {
            writeJson(res, 405, { error: `method not allowed (${req.method})` });
            return;
          }
          const root = queryParam(req, "root");
          const wid = queryParam(req, "id");
          if (!root || !wid) {
            writeJson(res, 400, { error: "expected ?root=<dir>&id=<workshop id>" });
            return;
          }
          try {
            const id = await store.importFromWorkshop(root, wid);
            writeJson(res, 201, { id });
          } catch (error) {
            writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
          }
        } catch (error) {
          logger.warn(error);
          writeJson(res, 500, { error: String(error) });
        }
      }
    },
    {
      kind: "exact",
      path: ROUTES.image,
      handler: async (req, res) => {
        if (!guard(req, res, "GET")) return;
        try {
          const id = queryParam(req, "id");
          if (!id) {
            writeJson(res, 400, { error: "expected ?id=<image id>" });
            return;
          }
          const found = await store.readImage(id);
          if (!found) {
            writeJson(res, 404, { error: "unknown image" });
            return;
          }
          res.writeHead(200, {
            "content-type": found.mime,
            "content-length": found.bytes.length,
            // ids are random and immutable — safe to cache hard.
            "cache-control": "public, max-age=31536000, immutable"
          });
          res.end(found.bytes);
        } catch (error) {
          logger.warn(error);
          writeJson(res, 500, { error: String(error) });
        }
      }
    }
  ];
}

// src/host/index.ts
var name = "bgStudio";
var inject = ["webServer"];
var Config = Schema.object({
  enabled: Schema.boolean().default(true),
  dshHome: Schema.string().default(""),
  maxImageMiB: Schema.number().default(20)
});
var electronWindows = null;
try {
  const require2 = createRequire(import.meta.url);
  const electron = require2("electron");
  if (electron && typeof electron.BrowserWindow?.getAllWindows === "function") {
    electronWindows = electron.BrowserWindow;
  }
} catch {
}
function primaryWindow() {
  if (!electronWindows) return null;
  const alive = electronWindows.getAllWindows().filter((w) => !w.isDestroyed());
  if (alive.length === 0) return null;
  return alive.reduce((a, b) => b.getBounds().width * b.getBounds().height > a.getBounds().width * a.getBounds().height ? b : a);
}
function applyWindowMaterial(material) {
  if (process.platform === "darwin") {
    return { ok: true, detail: "darwin-vibrancy-builtin" };
  }
  if (!electronWindows) return { ok: false, detail: "electron-unavailable" };
  const win = primaryWindow();
  if (!win) return { ok: false, detail: "no-window" };
  try {
    win.setBackgroundMaterial(material);
    return { ok: true, detail: material };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}
function apply(ctx, config) {
  if (config?.enabled === false) return;
  try {
    const dshHome = config.dshHome?.trim() !== "" ? config.dshHome : process.env.DSH_HOME ?? join2(homedir(), ".dsh");
    const store = new BgStudioStore(join2(dshHome, sep, "storages", "dsh-plugin-bg-studio"));
    const routes = makeRoutes({
      store,
      maxImageBytes: Math.max(1, config.maxImageMiB) * 1024 * 1024,
      logger: { warn: (error) => ctx.logger.warn(error) },
      applyWindowMaterial,
      activity: mountActivityBridge(ctx)
    });
    ctx.effect(() => {
      const disposers = routes.map((route) => ctx.webServer.register(route));
      return () => {
        for (const dispose of disposers) dispose();
      };
    }, "bg-studio: routes");
  } catch (error) {
    ctx.logger.warn(`[bg-studio] host apply degraded: ${error instanceof Error ? error.message : String(error)}`);
  }
}
export {
  Config,
  apply,
  applyWindowMaterial,
  inject,
  name
};
//# sourceMappingURL=index.js.map
