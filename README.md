# dsh-plugin-bg-studio

DeepSeek Harness (DSH) 桌面端 / Web UI 的背景自定义插件：**图片背景、透明、毛玻璃**三种模式自由切换，字体颜色始终跟随 DSH 深浅色主题不受影响。架构上为**动态壁纸**（视频 / Canvas / 网页 / Shader）预留了完整的 Provider 扩展位。

## 功能

| 模式 | 效果 | 可调参数 |
|---|---|---|
| 默认 | DSH 原生外观（像素级还原） | — |
| 图片 | 自定义图片铺在全部内容之下 | 图片库选择、填充方式（铺满/完整/平铺）、不透明度、模糊、压暗遮罩、遮罩颜色 |
| 透明 | 内容表面全透明，极简悬浮观感 | 表面保留底色、可读性蒙层 |
| 毛玻璃 | 表面呈磨砂玻璃，透出被模糊的背景 | 玻璃模糊度、底色浓度、色彩饱和、可选背景图（默认内置渐变） |
| 动态（规划中） | 动态壁纸 | 界面已预留入口；落地时新增一个 Provider 模块即可 |

核心契约：**只改背景与表面填充透明度，绝不触碰任何文字颜色 token**（`--dsw-alias-label-*` 全程原值），深浅色切换始终由 DSH 主题系统主导。

## 安装（DSH 桌面版）

构建产物已包含在发布包中，无需自行编译。

方式一：本地包（推荐）
1. `pnpm pack` 生成 `dsh-plugin-bg-studio-0.1.0.tgz`（仓库 release 已附）
2. DSH 桌面版 → 插件管理界面 → 输入 tgz 的**绝对路径**安装
3. 重启 DSH

方式二：npm（发布后）
```text
dsh-plugin-bg-studio
```

方式三：GitHub
```text
github:<user>/dsh-bg-studio#v0.1.0
```

安装后侧边栏"全局面板"会出现"背景"入口。

## 使用

- 侧边栏 → **背景** 面板：选择模式、调节参数，全部即时生效并自动保存（防抖持久化到 Host）。
- 图片库：上传（PNG/JPEG/WebP/GIF/BMP/AVIF，默认上限 20MB/张）、预览、点选、删除；新上传的图片在图片/毛玻璃模式下自动选中。
- "恢复默认"一键回到 DSH 原生外观。

数据位置：`~/.dsh/storages/dsh-plugin-bg-studio/`（`settings.json` + `images/`）。

## 开发

```sh
pnpm install
pnpm build        # esbuild → lib/index.js (host ESM) + lib/client.js (ModuleLoader 包装)
```

本地测试循环（独立 profile，不影响桌面版）：

```sh
dsh devbg --from-default-profile web      # 首次：从 web 模板建 profile（会自动启动，Ctrl+C 退出）
dsh plugin --profile devbg add <本项目绝对路径>
dsh --profile devbg                        # 启动 Web UI（默认 127.0.0.1:3080，带 token）
# 改代码 → pnpm build → 浏览器刷新；host 侧改动需重启 profile
```

## 架构（动态壁纸扩展点）

```
src/
├── shared/protocol.ts      # 设置协议：BackgroundKind 枚举 + 各模式参数 + 消毒/钳制
├── host/                   # Node 侧：ctx.webServer 路由（settings/images CRUD）+ 原子持久化
└── client/
    ├── background.ts       # 背景层（fixed 全窗 div）+ PROVIDERS 注册表 ← 扩展点
    ├── providers/          # 每种模式一个 Provider：mount/update/dispose
    ├── surface.ts          # 表面样式引擎：真实 DSH token 半透明化（深浅两套预计算色）
    ├── runtime.ts          # 状态管道：设置 → 表面样式 + 背景层；防抖持久化
    └── panel/              # 设置面板（官方 sidebar.panellist + main 插槽）
```

**新增动态壁纸模式的三步**（协议已预留 `animated` 段与 `mediaSource`/`respectReducedMotion` 字段）：
1. `protocol.ts`：`BackgroundKind` 加 `'animated'`，放开设定的参数段；
2. `providers/animated.ts`：实现 `BackgroundProvider`（`mount(el, settings, ctx)` 里渲染 `<video>`/`<canvas>`/iframe/Shader，`update` 处理参数变化不重启媒体，`dispose` 释放循环与媒体）；
3. `background.ts`：`PROVIDERS` 表注册 + 面板 `MODES` 数组放开禁用。

Host 侧无需任何改动（它只存取设置与媒体文件）。

### 表面 token 的来源与稳定性

`surface.ts` 中的 14 个 `--dsw-alias-*` / `--dsw-specific-*` 表面填充 token 捕获自 DSH 0.1.7 实机 DOM（深浅两套）。DSH 升级后若 token 改名，覆盖会静默失效（表现为模式切换后表面仍不透明）——届时重抓 token 表即可；文字 token 不在本插件触碰范围内，无回归风险。

## 已验证（DSH 0.1.7-rc.2 / Windows x64 / Node 22）

- 面板注册（侧栏行 + 中央页）、图片库上传/点选/删除、设置防抖持久化与重启恢复
- 三种模式视觉验收（外部视觉模型盲评：毛玻璃侧栏+主区渐变可见、图片满窗可读、透明模式界面完整）
- 深浅色切换期间文字 token 全程原值；切回"默认"后 token 像素级还原
- loopback 安全栅栏：非本机请求 403

## 已知边界

- "透明"模式的深度分环境：
  - **桌面版 + Windows 11**：插件会尝试为主窗口启用系统亚克力材质（`setBackgroundMaterial('acrylic')`，运行时 API、不要求窗口重建），成功后表面透明可透视桌面；面板会显示材质状态。
  - **桌面版 + Windows 10 / `dsh web` / CLI**：材质不可用时透出的是**窗口底色**——Electron 的 `transparent` 是窗口构造参数，DSH 的 Windows 主窗口未开启（macOS 版官方就开了 vibrancy + 透明底，Windows 侧需 DeepSeek 官方跟进），插件层无法跨越。
  - 设置面板自身保持不透明实底（跟随深浅主题），任何模式下都可读。
- 侧栏等处 DSH 用双层容器绘制同一 token，本插件按 1-√(1-α) 预补偿，使叠加后的观感等于面板设定值。

### 变更记录

- **0.2.1 UI 修复**：图片库改为按需显示（仅图片/毛玻璃模式；默认/透明/动态不再出现，动态模式有自己的壁纸包区）；修复原生下拉框（玻璃背后图片等）在深色模式下弹出白底白字、hover 才可见的问题（`color-scheme` + option 配色双保险）。
- **0.2.0 动态壁纸架构**：新增"动态"模式与 **壁纸包**（`dsh-wallpaper/1` 格式：目录 + `manifest.json`），四类渲染器——`video`（视频）、`web`（沙箱 iframe 网页壁纸，经 postMessage 接收活动状态，WE 式生态位）、`canvas`（内置编程场景，当前含 nebula 星云）、`character`（精灵图角色 + 任务状态机）。任务活动桥监听全局 `session/event`（turn/start/end），按阈值推导 idle/busy/overloaded 三态；idle 支持多套动作定时轮换。面板支持壁纸包导入（本地目录）/选择/删除、忙碌阈值、轮换间隔、减少动态偏好。`GET /api/dsh-bg-studio/activity?debugState=` 为测试钩子。三个示例包见 `dev-assets/wallpapers/`。
- **0.1.4**：修复报告指出的"设置界面透明"——此前的修复只覆盖了插件的背景面板，本版把 **DSH 原生系统模态**（左下角"设置"对话框 `[data-shortcut-modal]`，含其他系统弹窗）在背景模式下恢复不透明实底，并纳入"设置面板保持不透明"开关统一控制（关掉开关则系统模态也跟随透明）。
- **0.1.3**：macOS 兼容加固——窗口材质调用按平台分支（mac 无需调用即原生透明，面板状态如实显示"已生效"；`setBackgroundMaterial` 是 Windows 专属 API，不再在 mac 上误试）。静态审查确认：无硬编码路径、Node 模块全跨平台、Web UI 前端三平台同构。
- **0.1.2**：设置面板实底改为组件 inline 样式（不依赖注入 CSS 的加载顺序/客户端缓存，修复桌面端面板仍透明的报告）；新增"设置面板保持不透明"开关；"恢复默认"重定义为"重置当前模式参数"（保留模式与选图）；透明模式标记为实验性。
- **0.1.1**：修复滑杆拖动无效（provider.update 漏传 ctx 导致参数更新中断）；设置面板改为不透明实底；透明模式新增 Win11 亚克力窗口材质尝试 + 状态提示；透明模式不再透明化设置面板自身。
- **0.1.0**：首发（图片/透明/毛玻璃 + 动态壁纸预留）。

## License

MIT
