# WebProgram 本地 Web 项目集合

本目录用于集中存放本地 Web 应用项目及配套的启动/停止脚本。

## 目录结构

```text
webprogram/
├── douyin-local/                       # 抖音本地沉浸版（前端 + Node 本地媒体服务）
│   ├── 启动-抖音本地版.bat
│   ├── 停止-抖音本地版.bat
│   └── 开机静默启动-抖音本地版.vbs
├── tesla-dashcam/                      # Tesla FSD V15 3D 实景车机与行车记录仪查看器（Three.js + 游戏手柄）
│   ├── 启动-特斯拉行车记录仪.bat
│   └── 停止-特斯拉行车记录仪.bat
├── safe-usb-mover/                     # 防掉盘渐进式安全搬运助手（U 盘 / 移动硬盘 / MTP 手机直连）
│   ├── 启动-安全搬运助手.bat
│   ├── 停止-安全搬运助手.bat
│   └── 开机静默启动-安全搬运助手.vbs
├── dsh-plugin-incident-drawer/         # DeepSeek Harness 右侧悬浮事件单插件
│   ├── scripts/install-local.bat
│   └── scripts/pack-offline.bat
├── chrome-incident-drawer/             # Chrome MV3 网页右侧悬浮事件单扩展（与 DSH 共享 Excel）
│   ├── start-bridge.bat
│   ├── start-bridge-silent.vbs
│   ├── stop-bridge.bat
│   └── extension/
├── win-incident-stage/                 # Windows 桌面端 iPadOS 前台调度风事件单悬浮台（含快捷红绿灯 / 键盘小猫待办 / 悬浮球播放器）
│   ├── start-desktop.bat
│   └── start-desktop-silent.vbs
└── README.md
```

---

## 应用介绍

### 1. 抖音本地沉浸版 (`douyin-local`)

- **默认访问地址**：`http://127.0.0.1:3002/`
- **技术栈**：React 19 + TypeScript + Vite + Tailwind CSS + Node.js (`server/index.mjs`)
- **核心功能**：
  - **本地媒体库索引**：读取本地下载目录（默认 `J:\GitProject\DouzyDownload`，可通过环境变量 `DOUYIN_MEDIA_ROOT` 指定），支持视频与图文作品。
  - **沉浸式信息流与浏览**：支持推荐流、我的关注、图文精选、标签（`#tag`）筛选、合集播放、关键词搜索，以及悬浮音量调节条防误关、纵向拖拽与滚轮精调。
  - **作者主页抽屉**：点击作者可查看其作品列表并切换播放/关注。
  - **本地状态持久化**：点赞、收藏、关注、观看历史与推荐权重会保存在 `douyin-local/server/user-state.json`。

### 2. Tesla V15 实景车机 & 行车记录仪 (`tesla-dashcam`)

- **默认访问地址**：`http://127.0.0.1:3000/`
- **技术栈**：React 19 + TypeScript + Three.js + Vite + Tailwind CSS
- **核心功能**：
  - **Tesla FSD V15 3D 实景主屏（Reality View）**：基于 Three.js PBR 与 Bloom 泛光渲染实时写实城市环境，支持 3 种天气光照（夜雨霓虹 / 落日余晖 / 晴朗白昼）、4 种视角、5 款原厂车漆、FSD 规划轨迹与 AR 导航箭头及点击路面导航（Tap-to-Navigate）。
  - **即插即用游戏手柄 & 键鼠驾驶**：支持 Xbox / DualSense 手柄线性油门刹车、转向、360° 环视及快捷切视角 / 天气 / 车漆 / 呼出行车记录仪。
  - **多路行车记录仪查看器**：内置 4 路同步演示数据，支持本地特斯拉 U 盘 `TeslaCam` 导入解析、单主视角 / 四路同屏、逐帧步进与高清截图导出。详见 [tesla-dashcam/README.md](tesla-dashcam/README.md)。

### 3. 防掉盘渐进式安全搬运助手 (`safe-usb-mover`)

- **默认访问地址**：`http://127.0.0.1:3005/`
- **技术栈**：零依赖原生 Node.js (`server.mjs` + `mtpHelper.mjs`) + 单页暗色 Web 控制台 (`public/index.html`)
- **核心功能**：
  - **MTP 手机直连 & 实时空间监测**：除传统 U 盘 / 移动硬盘外，支持免 ADB 识别 Windows「此电脑」便携设备（如 Pixel 手机内部存储），实时监测空间并支持「见缝插针」渐进搬运。
  - **内置极速文件夹浏览器**：内置弹窗同时支持浏览本地磁盘与手机目录及新建文件夹，解决系统目录选择框卡顿或被遮挡的问题。
  - **原子安全搬运与两段式安全停止**：限速写入 `.safemove.part` → `fsync` → 校验 → 原子改名后再删源；支持「安全停止」（写完并核验当前文件后平稳停机）与「强制中断」应急清理，固定高度状态栏切换零抖动。详见 [safe-usb-mover/README.md](safe-usb-mover/README.md)。

### 4. DeepSeek Harness 事件单悬浮侧边栏 (`dsh-plugin-incident-drawer`)

- **技术栈**：Cordis 双端插件（Host Excel 无损读写 + Client `shell.overlay` React 悬浮抽屉，零运行时外部依赖）
- **核心功能**：贴合 DSH 右侧边缘、悬停向左展开单号、点击手风琴展开动态表头编辑、第 1 列只读超链接跳转、失焦自动保存与外部变更防覆盖。详见 [dsh-plugin-incident-drawer/README.md](dsh-plugin-incident-drawer/README.md)。

### 5. Chrome 事件单悬浮侧边栏 (`chrome-incident-drawer`)

- **默认伴生服务地址**：`http://127.0.0.1:17892/`
- **技术栈**：Chrome Manifest V3（Shadow DOM 隔离 UI）+ 零依赖本地 Node 伴生服务
- **核心功能**：与 DSH 插件共用同一份配置与本地 Excel，支持网页右侧悬浮编辑、黑白名单域名规则及深浅色主题。详见 [chrome-incident-drawer/README.md](chrome-incident-drawer/README.md)。

### 6. Windows 事件单前台调度台 (`win-incident-stage`)

- **技术栈**：Electron 透明置顶穿透窗 + React + TypeScript + iPadOS 前台调度（Stage Manager）3D UI + Win32/SMTC 系统集成
- **核心功能**：全局置顶悬浮在所有桌面应用上方（空白处完全鼠标穿透），与 DSH 和 Chrome 插件三端共用配置与本地 Excel；右侧 3D 透视事件单与可拖拽调宽前台编辑卡片、顶部状态按钮下方分离式 macOS 快捷红绿灯（支持组合键录制）、右下角经典键盘小猫与全息前景待办卡片、琉璃光弧悬浮球音乐播放器（悬停放大黑洞光晕 + 专辑封面 + 本地音乐目录/Windows SMTC 联动），并支持打包绿色便携 `IncidentStage.exe`。详见 [win-incident-stage/README.md](win-incident-stage/README.md)。

---

## 使用方式

### 方式一：双击各项目目录内的一键脚本（推荐）

所有脚本均使用**相对自身目录定位**（移动项目目录不影响运行），并采用纯 ASCII + CRLF 编码避免 Windows 命令行乱码：

- **抖音本地版**（`douyin-local/`）：双击 `启动-抖音本地版.bat`（端口 `3002`） / `停止-抖音本地版.bat` / `开机静默启动-抖音本地版.vbs`
- **特斯拉行车记录仪**（`tesla-dashcam/`）：双击 `启动-特斯拉行车记录仪.bat`（端口 `3000`） / `停止-特斯拉行车记录仪.bat`
- **防掉盘安全搬运助手**（`safe-usb-mover/`）：双击 `启动-安全搬运助手.bat`（端口 `3005`） / `停止-安全搬运助手.bat` / `开机静默启动-安全搬运助手.vbs`
- **Chrome 事件单悬浮侧边栏**（`chrome-incident-drawer/`）：双击 `start-bridge-silent.vbs`（端口 `17892`） / `start-bridge.bat` / `stop-bridge.bat`，再于 Chrome `chrome://extensions/` 加载 `extension/` 目录
- **DSH 事件单悬浮侧边栏**（`dsh-plugin-incident-drawer/`）：执行 `scripts\pack-offline.bat` 或 `scripts\install-local.bat` 安装至 DSH
- **Windows 事件单前台调度台**（`win-incident-stage/`）：双击 `start-desktop-silent.vbs` 或 `start-desktop.bat`（支持 `npm run pack:portable` 生成免安装 `IncidentStage.exe`）

> 如需开机自启，请右键对应 `.vbs` **创建快捷方式**后拖入 `Win + R` → `shell:startup`（不要移动原 `.vbs` 文件）。

### 方式二：命令行手动运行

#### 抖音本地沉浸版 (`douyin-local`)

```powershell
cd d:\WorkSpaceAi\webprogram\douyin-local

# 直接运行内置服务（提供前端构建产物与媒体 API，默认端口 3002）
npm run server

# 如需自定义媒体目录（示例）：
$env:DOUYIN_MEDIA_ROOT = "D:\Media\Douyin"
node server/index.mjs

# 前端开发调试 / 重新构建
npm run dev
npm run build
```

#### 特斯拉行车记录仪 (`tesla-dashcam`)

```powershell
cd d:\WorkSpaceAi\webprogram\tesla-dashcam

# 开发模式
npm run dev

# 构建并本地预览（默认端口 3000）
npm run build
npx vite preview --port 3000 --host 127.0.0.1
```
