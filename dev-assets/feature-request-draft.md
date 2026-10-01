# Feature Request Draft — Transparent / acrylic window on Windows

> 提交位置：https://github.com/deepseek-ai/deepseek-harness/discussions/new?category=ideas
> 分类选 **💡 Ideas**。标题和正文直接复制下面内容。

---

**Title:**

```
[Windows] Native transparent / acrylic window option (the win32 branch is missing what the macOS branch already has)
```

**Body:**

````markdown
### The ask

Add an opt-in "transparent window" mode for the **Windows** desktop build, so a
cleared page background can reveal the desktop (acrylic/mica), the same way the
macOS build already behaves.

### What's already there

In `createWindow` (main process), the **darwin** branch already opts into the
native material:

```js
process.platform === "darwin" ? {
  titleBarStyle: "hiddenInset",
  vibrancy: "sidebar",
  visualEffectState: "active",
  backgroundColor: "#00000000"
} : {},
```

The **win32** branch only styles the title bar overlay — no `transparent`, no
`backgroundMaterial`. So on Windows, a fully transparent page still sits on an
opaque window color, and neither users nor plugins can go further.

### Suggested fix (one flag, no redesign)

Add to the win32 branch (behind a setting, off by default):

```js
// Electron natively supports DWM materials on Win11:
backgroundMaterial: "acrylic"   // or "mica"
// and/or the classic path (frameless not required with the 00-alpha trick):
backgroundColor: "#00000000"
```

References:

- Electron `backgroundMaterial` window option: https://electronjs.org/docs/latest/api/structures/base-window-options
- Community modules proving this works for framed Electron windows on Win11:
  https://github.com/pykeio/vibe , https://github.com/GregVido/mica-electron

### Why external workarounds fail (context)

- `transparent` is a constructor-only option, so no plugin or user script can
  enable it after launch.
- Calling `SetWindowCompositionAttribute` / `ACCENT_ENABLE_ACRYLICBLURBEHIND`
  from outside the process returns success but has **no visual effect** on
  current Windows 11 builds for Chromium-rendered windows (verified locally).
- macOS users effectively already have this feature via `vibrancy`.

### Real-world consumer

A community background-customization plugin (image / frosted-glass backgrounds)
works across platforms, but on Windows its "transparent" mode can only reveal
the window color. Several skin and background plugins in the community
directory would benefit from a native option.

One constructor flag behind a settings toggle would close the gap. Thanks!
````

---

## 提交步骤（3 分钟）

1. 打开 https://github.com/deepseek-ai/deepseek-harness/discussions/new?category=ideas
   （或：仓库 → Discussions → New discussion → 选 💡 Ideas）
2. Title 粘贴上面的标题
3. Body 粘贴正文
4. Start discussion 提交
5. 可选加分项：附一张 macOS 毛玻璃截图 vs Windows 不透明截图的对比图，说服力更强
