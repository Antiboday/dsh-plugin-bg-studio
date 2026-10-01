# Feature Request Draft — Transparent / acrylic window on Windows

> 提交位置：https://github.com/deepseek-ai/deepseek-harness/discussions/new?category=ideas
> 分类选 **💡 Ideas**。
> 该讨论区是中英双语社区（约一半帖子为中文），中英文任选——两版文稿都在本文件里，任选其一使用。

---

## 中文版

**标题：**

```
[Windows] 希望桌面端提供原生透明 / 亚克力窗口选项（win32 分支缺少 macOS 分支已有的处理）
```

**正文：**

````markdown
### 诉求

希望 Windows 桌面版能提供一个可选的"透明窗口"模式：页面背景清空后可以透出桌面
（亚克力 / 云母材质），与 macOS 版当前的行为保持一致。

### 现状

主进程 `createWindow` 中，**darwin** 分支已经启用了原生材质：

```js
process.platform === "darwin" ? {
  titleBarStyle: "hiddenInset",
  vibrancy: "sidebar",
  visualEffectState: "active",
  backgroundColor: "#00000000"
} : {},
```

而 **win32** 分支只处理了标题栏 overlay——既没有 `transparent` 也没有
`backgroundMaterial`。因此在 Windows 上，页面即使完全透明，底下仍是不透明的窗口
底色，用户和插件都无法更进一步。

### 建议的修复（一个开关即可，不必改设计）

在 win32 分支增加（放在设置项后面，默认关闭）：

```js
// Electron 原生支持 Win11 的 DWM 材质：
backgroundMaterial: "acrylic"   // 或 "mica"
// 和/或经典做法（配合 00-alpha 底色技巧，有边框窗口也可用）：
backgroundColor: "#00000000"
```

参考：

- Electron `backgroundMaterial` 窗口选项文档：
  https://electronjs.org/docs/latest/api/structures/base-window-options
- 社区模块已证明带边框的 Electron 窗口在 Win11 上可行：
  https://github.com/pykeio/vibe 、 https://github.com/GregVido/mica-electron

### 为什么外部绕路都走不通（已实测）

- `transparent` 是窗口构造期参数，启动后任何插件/脚本都无法补开；
- 从进程外调用 `SetWindowCompositionAttribute` / `ACCENT_ENABLE_ACRYLICBLURBEHIND`
  返回成功，但在当前 Windows 11 上对 Chromium 自绘窗口**无任何视觉效果**
  （本机已验证）；
- macOS 用户实际上已经通过 `vibrancy` 拥有了这个能力。

### 现实受益方

社区的背景定制 / 皮肤类插件（图片背景、毛玻璃等）在其他平台工作正常，唯独
Windows 端的"透明"模式只能透出窗口底色。一个放在设置里的构造参数开关就能补齐
这个差距。谢谢！
````

---

## English version

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
