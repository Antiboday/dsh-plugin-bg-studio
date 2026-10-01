# Background Studio — DeepSeek Harness 背景与动态壁纸引擎

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）打造的背景自定义插件：**图片、透明、毛玻璃**三种静态模式 + Wallpaper Engine 式**动态壁纸引擎**（视频 / 网页 / 编程场景 / 随任务联动的角色），外加一键导入 WE 创意工坊壁纸。设计铁律：**绝不触碰文字颜色**——可读性始终由应用自己的深浅色主题决定。

[English](README.md)

## 功能一览

### 四种背景模式

| 模式 | 效果 |
|---|---|
| **图片** | 自定义图片铺在所有内容之下：填充方式（铺满/完整/平铺）、不透明度、模糊、可读性遮罩（强度 + 自定义颜色） |
| **透明** | 内容表面全透明；Windows 11 桌面版会尝试系统亚克力窗口材质，表面透明后可透视桌面 |
| **毛玻璃** | 表面呈半透明玻璃：模糊度、底色浓度、色彩饱和可调（侧栏双层容器做了透明度补偿，所见即所得） |
| **动态** | 完整壁纸引擎，见下 |

侧边栏「背景」面板一键切换，改动即时生效、自动保存；「重置当前模式参数」只回该模式的出厂值（模式和选图保留）。

### 动态壁纸引擎

壁纸以**包**（`dsh-wallpaper/1` 格式：目录 + `manifest.json` + 资源）组织，四类渲染器：

- **视频**：浏览器可解码的任意 mp4/webm；壁纸级音量/速度/适配（热应用不重启）。有声自动播放被桌面版策略拒绝时自动降级静音，首次点击恢复声音。
- **网页**：沙箱 iframe 跑任意 HTML。伺服时自动重写相对路径并注入 **Wallpaper Engine API 兼容层**（`wallpaperRegister*` 等）——多数 WE 网页壁纸无需修改直接运行；页面可通过 `window` 消息事件接入实时代理任务状态。
- **场景**：内置编程场景（附星云星空）；加一个场景 = 注册表加一项。
- **角色**：精灵图 + **任务状态机**——空闲（多套动作定时轮换）、忙碌、超载（阈值可调）。状态桥只读回合事件元数据，**不读会话内容**。

### Wallpaper Engine 一键导入

面板指向 Steam 创意工坊目录（`…\steamapps\workshop\content\431960`）即列出全部壁纸：视频/网页型**一键转换**入库（不写入工坊目录；视频包只拷影片文件省空间）；场景型标注"暂不支持"及原因。附无界面转换器 `dev-assets/we2dsh.py`。

### 主题氛围提醒

激活一张与当前界面明暗明显"唱反调"的壁纸时，弹出一键切题的小提示（走应用官方设置通道）：

> 「壁纸已入夜，界面还亮着灯。要一起关灯看星星吗？」🌙
> 「壁纸天亮了，界面还赖在夜里。要一起掀开窗帘吗？」☀️

基调来自 manifest 声明，视频壁纸自动采样画面亮度；每次切换到不匹配的壁纸都会提醒，唯一静音方式是你显式点「这张壁纸不再提醒」。

### 细节

- **完整国际化**：接入 DSH 官方 locale 服务，面板与提示文案实时跟随应用语言设置（中英双语内置）。
- 插件面板与 DSH 系统设置页**各自独立的不透明开关**（透明/毛玻璃模式下默认都不透明，保证可读）。
- 面板在应用裁切布局内自滚动；原生下拉弹层遵循深色模式。
- **隐私设计**：所有路由仅限本机回环；任务状态桥只读回合元数据。

## 安装

**发行包**（推荐）：从 [Releases](../../releases) 下载 `.tgz`，DSH 打开 *插件 → 从本地包安装*，填入 tarball 绝对路径。**彻底退出 DSH（含托盘）再重开**——插件代码缓存很顽固。

**GitHub**（tag 源码自带预构建 `lib/`，无需编译）：

```text
github:<user>/dsh-plugin-bg-studio#v0.4.2
```

**npm**（如已发布）：

```text
dsh-plugin-bg-studio
```

> ⚠️ 若插件管理器装卸报 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` 并点名某个无关包：
> 是当天新发布的依赖触发了 24 小时供应链冷却期并连坐整个锁文件。窗口过后自愈；急用见[故障排除](#故障排除)。

## 编写壁纸包

```jsonc
// manifest.json
{
  "format": "dsh-wallpaper/1",
  "name": "我的壁纸",
  "description": "…",
  "author": "你",
  "type": "video",            // video | web | canvas | character
  "entry": "bg.mp4",          // video: 文件 · web: html · canvas: "scene:nebula" · character: mascot.json
  "tone": "dark",             // 可选：dark | light — 启用主题氛围提醒
  "states": {                 // 仅角色型：mascot.json 中的动画名
    "idle": ["nap", "wag"],
    "busy": ["type"],
    "overloaded": ["panic"]
  }
}
```

角色包另加 `mascot.json`（精灵图规格：帧尺寸、帧率、命名片段区间）。`dev-assets/wallpapers/` 内含四种类型的完整可运行示例。

**网页壁纸**接收实时任务状态：

```js
window.addEventListener('message', (ev) => {
  const d = ev.data
  if (d?.source === 'dsh-bg-studio' && d?.type === 'activity') {
    // d.state: 'idle' | 'busy' | 'overloaded'   d.idleClip: 当前空闲片段名
  }
})
```

## 故障排除

- **装卸被 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` 拦** —— 完全退出 DSH 后在 `%DSH_HOME%\profiles\<名>` 目录用系统 pnpm 执行 `pnpm add/remove`（无此策略），并同步 `dsh.profile.bundles`；或等冷却窗口结束。
- **更新后行为没变** —— 彻底退出 DSH（含托盘）重开，否则旧代码仍在跑。
- **网页壁纸白屏** —— 脚本可能用了沙箱未提供的 API（内置 shim 已覆盖 WE API 家族），其余欢迎提 issue。

## 开发

```sh
pnpm install
node tools/build.mjs      # esbuild → lib/（host ESM + ModuleLoader 包装的 client）

# 一次性测试 profile（不动桌面 profile）
dsh devbg --from-default-profile web        # 启动一次，Ctrl+C
dsh plugin --profile devbg add "$(pwd)"
dsh --profile devbg                          # Web UI @ 127.0.0.1:3080
```

架构速览：`shared/` 协议（设置 + 包格式）、Node host（存储/媒体库/回环路由/任务事件桥）、web client（Provider 注册表 → 四渲染器 / 表面 token 样式 / i18n / 氛围提醒）。加渲染器、加场景、加包字段都不用动 host。

## 许可

[MIT](LICENSE)
