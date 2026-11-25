# WebProgram 本地 Web 项目集合

本目录用于集中存放本地 Web 应用项目及配套的启动/停止脚本。

## 目录结构

```text
webprogram/
├── douyin-local/                       # 抖音本地沉浸版（前端 + Node 本地媒体服务）
│   ├── 启动-抖音本地版.bat
│   ├── 停止-抖音本地版.bat
│   └── 开机静默启动-抖音本地版.vbs
├── tesla-dashcam/                      # 特斯拉行车记录仪播放器（纯前端车机模拟器）
│   ├── 启动-特斯拉行车记录仪.bat
│   └── 停止-特斯拉行车记录仪.bat
├── safe-usb-mover/                     # 防掉盘渐进式安全搬运助手
│   ├── 启动-安全搬运助手.bat
│   ├── 停止-安全搬运助手.bat
│   └── 开机静默启动-安全搬运助手.vbs
└── README.md
```

---

## 应用介绍

### 1. 抖音本地沉浸版 (`douyin-local`)

- **默认访问地址**：`http://127.0.0.1:3002/`
- **技术栈**：React 19 + TypeScript + Vite + Tailwind CSS + Node.js (`server/index.mjs`)
- **核心功能**：
  - **本地媒体库索引**：读取本地下载目录（默认 `J:\GitProject\DouzyDownload`，可通过环境变量 `DOUYIN_MEDIA_ROOT` 指定），支持视频与图文作品。
  - **沉浸式信息流与浏览**：支持推荐流、我的关注、图文精选、标签（`#tag`）筛选、合集播放以及关键词搜索。
  - **作者主页抽屉**：点击作者可查看其作品列表并切换播放/关注。
  - **本地状态持久化**：点赞、收藏、关注、观看历史与推荐权重会保存在 `douyin-local/server/user-state.json`。

### 2. 特斯拉行车记录仪 (`tesla-dashcam`)

- **默认访问地址**：`http://127.0.0.1:3000/`
- **技术栈**：React 19 + TypeScript + Vite + Tailwind CSS
- **核心功能**：
  - **仿特斯拉车机桌面**：包含顶部状态栏、底部 Dock、深浅色主题切换及车机设置弹窗。
  - **多路行车记录仪回放**：内置 4 路同步演示数据，支持哨兵模式（Sentry）等事件浏览与删除。
  - **本地 U 盘导入**：支持直接导入本地特斯拉行车记录仪文件夹进行事件解析与回放，也可随时恢复内置演示数据。

### 3. 防掉盘渐进式安全搬运助手 (`safe-usb-mover`)

- **默认访问地址**：`http://127.0.0.1:3005/`
- **技术栈**：零依赖原生 Node.js (`server.mjs`) + 单页暗色 Web 控制台 (`public/index.html`)
- **核心功能**：
  - **实时空间监测 & 见缝插针**：持续监测移动存储剩余空间，有空间就逐个平滑搬运，并默认预留安全空间余量。
  - **防掉盘原子五步搬运**：限速写入 `.safemove.part` → `fsync` 落盘 → 回读 `SHA-256` 校验 → 原子改名 → 校验无误才删源（或移入回收站），搭配冷却散热与掉盘自动重连自愈。
  - **独立启停脚本**：`safe-usb-mover/` 内自带 `启动-安全搬运助手.bat`、`停止-安全搬运助手.bat` 与 `开机静默启动-安全搬运助手.vbs`。

---

## 使用方式

### 方式一：双击各项目目录内的一键脚本（推荐）

所有脚本均使用**相对自身目录定位**（移动项目目录不影响运行），并采用纯 ASCII + CRLF 编码避免 Windows 命令行乱码：

- **抖音本地版**（`douyin-local/`）：双击 `启动-抖音本地版.bat`（端口 `3002`） / `停止-抖音本地版.bat` / `开机静默启动-抖音本地版.vbs`
- **特斯拉行车记录仪**（`tesla-dashcam/`）：双击 `启动-特斯拉行车记录仪.bat`（端口 `3000`） / `停止-特斯拉行车记录仪.bat`
- **防掉盘安全搬运助手**（`safe-usb-mover/`）：双击 `启动-安全搬运助手.bat`（端口 `3005`） / `停止-安全搬运助手.bat` / `开机静默启动-安全搬运助手.vbs`

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
