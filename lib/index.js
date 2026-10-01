// src/host/index.ts
import { homedir } from "node:os";
import { createRequire } from "node:module";
import { join as join2, sep } from "node:path";
import Schema from "@deepseek-ai/schemastery";

// src/host/store.ts
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

// src/shared/protocol.ts
var DEFAULT_SETTINGS = {
  kind: "none",
  image: { imageId: null, fit: "cover", opacity: 1, blur: 0, dim: 0.25, tint: null },
  transparent: { surfaceOpacity: 0, scrim: 0.08 },
  frosted: { blur: 18, surfaceOpacity: 0.55, saturation: 1.25, imageId: null },
  animated: { mediaSource: null, respectReducedMotion: true },
  panelOpaque: true
};
function clamp(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
function sanitizeSettings(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const img = src.image && typeof src.image === "object" ? src.image : {};
  const tra = src.transparent && typeof src.transparent === "object" ? src.transparent : {};
  const fro = src.frosted && typeof src.frosted === "object" ? src.frosted : {};
  const ani = src.animated && typeof src.animated === "object" ? src.animated : {};
  const kind = ["none", "image", "transparent", "frosted"].includes(src.kind) ? src.kind : "none";
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
      mediaSource: typeof ani.mediaSource === "string" ? ani.mediaSource : null,
      respectReducedMotion: ani.respectReducedMotion !== false
    },
    panelOpaque: src.panelOpaque !== false
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

// src/host/store.ts
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
};

// src/host/routes.ts
var ROUTES = {
  settings: "/api/dsh-bg-studio/settings",
  reset: "/api/dsh-bg-studio/reset",
  images: "/api/dsh-bg-studio/images",
  image: "/api/dsh-bg-studio/image",
  windowMaterial: "/api/dsh-bg-studio/window-material"
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
function makeRoutes({ store, maxImageBytes, logger, applyWindowMaterial: applyWindowMaterial2 }) {
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
      applyWindowMaterial
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
